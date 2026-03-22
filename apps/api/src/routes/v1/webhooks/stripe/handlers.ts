import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../../../lib/prisma.js";
import { stripe, STRIPE_WEBHOOK_SECRET } from "../../../../services/stripe/index.js";
import type Stripe from "stripe";

export async function handleStripeWebhook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const sig = request.headers["stripe-signature"];
  if (!sig) {
    return reply.status(400).send({ error: "Missing stripe-signature header" });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      request.body as Buffer,
      sig,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    request.log.error(err, "Stripe webhook signature verification failed");
    return reply.status(400).send({ error: "Invalid signature" });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;

    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case "invoice.paid":
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;

    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    default:
      request.log.info(`Unhandled Stripe event: ${event.type}`);
  }

  return reply.send({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = Number(session.metadata?.userId);
  const planId = Number(session.metadata?.planId);

  if (!userId || !planId) return;

  const stripeSubscription = await stripe.subscriptions.retrieve(
    session.subscription as string,
  );

  await prisma.subscription.create({
    data: {
      userId,
      planId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: stripeSubscription.id,
      status: stripeSubscription.status === "trialing" ? "trialing" : "active",
      billingInterval:
        (stripeSubscription.metadata?.billingInterval as string) || "monthly",
      trialEndsAt: stripeSubscription.trial_end
        ? new Date(stripeSubscription.trial_end * 1000)
        : null,
      currentPeriodStart: stripeSubscription.items.data[0]
        ? new Date(stripeSubscription.items.data[0].current_period_start * 1000)
        : null,
      currentPeriodEnd: stripeSubscription.items.data[0]
        ? new Date(stripeSubscription.items.data[0].current_period_end * 1000)
        : null,
    },
  });
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
  });

  if (!existing) return;

  const item = sub.items.data[0];
  await prisma.subscription.update({
    where: { stripeSubscriptionId: sub.id },
    data: {
      status: sub.status,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      currentPeriodStart: item
        ? new Date(item.current_period_start * 1000)
        : null,
      currentPeriodEnd: item
        ? new Date(item.current_period_end * 1000)
        : null,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    },
  });
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data: { status: "canceled" },
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (invoice.subscription) {
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: invoice.subscription as string },
      data: { status: "active" },
    });
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  if (invoice.subscription) {
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: invoice.subscription as string },
      data: { status: "past_due" },
    });
  }
}
