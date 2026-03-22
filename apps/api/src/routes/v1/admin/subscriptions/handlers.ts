import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../../../lib/prisma.js";
import { stripe } from "../../../../services/stripe/index.js";
import type {
  CreateCheckoutBody,
  SubscriptionParams,
  CustomerPortalBody,
} from "./schema.js";

/**
 * GET /admin/subscriptions - List all subscriptions.
 */
export async function listSubscriptions(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const subs = await prisma.subscription.findMany({
    include: {
      user: { select: { id: true, email: true, name: true, role: true } },
      plan: { select: { id: true, name: true, slug: true, role: true, tier: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return reply.send(subs);
}

/**
 * POST /admin/subscriptions/checkout - Create a Stripe Checkout session.
 * Called by the user (any authenticated user) to start a subscription.
 */
export async function createCheckout(
  request: FastifyRequest<{ Body: CreateCheckoutBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { planId, billingInterval, successUrl, cancelUrl } = request.body;
  const user = request.currentUser;

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    return reply.status(404).send({ error: "Plan not found" });
  }

  if (plan.role !== user.role) {
    return reply.status(400).send({ error: "Plan does not match your role" });
  }

  if (!stripe) {
    return reply.status(503).send({ error: "Stripe is not configured" });
  }

  // Find or create Stripe customer
  let subscription = await prisma.subscription.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  let customerId = subscription?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: String(user.id), role: user.role },
    });
    customerId = customer.id;
  }

  const priceId =
    billingInterval === "annual" ? plan.stripeAnnualPriceId : plan.stripeMonthlyPriceId;

  if (!priceId) {
    return reply.status(400).send({ error: "Stripe price not configured for this plan/interval" });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      trial_period_days: plan.trialDays > 0 ? plan.trialDays : undefined,
      metadata: {
        userId: String(user.id),
        planId: String(plan.id),
        billingInterval,
      },
    },
    metadata: {
      userId: String(user.id),
      planId: String(plan.id),
    },
  });

  return reply.send({ checkoutUrl: session.url });
}

/**
 * POST /admin/subscriptions/portal - Create a Stripe Customer Portal session.
 */
export async function createPortalSession(
  request: FastifyRequest<{ Body: CustomerPortalBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { returnUrl } = request.body;
  const user = request.currentUser;

  const subscription = await prisma.subscription.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription?.stripeCustomerId) {
    return reply.status(404).send({ error: "No billing account found" });
  }

  if (!stripe) {
    return reply.status(503).send({ error: "Stripe is not configured" });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: returnUrl,
  });

  return reply.send({ portalUrl: session.url });
}

/**
 * GET /admin/subscriptions/me - Get current user's subscription.
 */
export async function mySubscription(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = request.currentUser;

  const subscription = await prisma.subscription.findFirst({
    where: { userId: user.id, status: { in: ["active", "trialing"] } },
    include: {
      plan: {
        include: {
          features: { include: { feature: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    // Return the free plan for their role
    const freePlan = await prisma.plan.findFirst({
      where: { role: user.role, tier: "FREE", isActive: true },
      include: {
        features: { include: { feature: true } },
      },
    });

    return reply.send({
      subscription: null,
      plan: freePlan,
      features: freePlan?.features.map((pf) => pf.feature.key) || [],
    });
  }

  return reply.send({
    subscription: {
      id: subscription.id,
      status: subscription.status,
      billingInterval: subscription.billingInterval,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      seatCount: subscription.seatCount,
    },
    plan: {
      id: subscription.plan.id,
      name: subscription.plan.name,
      slug: subscription.plan.slug,
      tier: subscription.plan.tier,
    },
    features: subscription.plan.features.map((pf) => pf.feature.key),
  });
}
