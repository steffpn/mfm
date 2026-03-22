import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../../../lib/prisma.js";
import type {
  PlanParams,
  PlanBody,
  PlanFeatureParams,
  AssignFeatureBody,
} from "./schema.js";

/**
 * GET /admin/plans - List all plans with their features.
 */
export async function listPlans(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const plans = await prisma.plan.findMany({
    include: { features: { include: { feature: true } } },
    orderBy: { createdAt: "desc" },
  });

  return reply.send(
    plans.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      role: p.role,
      tier: p.tier,
      monthlyPriceCents: p.monthlyPriceCents,
      annualPriceCents: p.annualPriceCents,
      trialDays: p.trialDays,
      perSeatPriceCents: p.perSeatPriceCents,
      perSeatLabel: p.perSeatLabel,
      stripeMonthlyPriceId: p.stripeMonthlyPriceId,
      stripeAnnualPriceId: p.stripeAnnualPriceId,
      stripeProductId: p.stripeProductId,
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      features: p.features.map((pf) => ({
        id: pf.feature.id,
        key: pf.feature.key,
        name: pf.feature.name,
        category: pf.feature.category,
      })),
    })),
  );
}

/**
 * POST /admin/plans - Create a plan.
 */
export async function createPlan(
  request: FastifyRequest<{ Body: PlanBody }>,
  reply: FastifyReply,
): Promise<void> {
  const plan = await prisma.plan.create({
    data: request.body,
  });

  return reply.status(201).send({
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    role: plan.role,
    tier: plan.tier,
    monthlyPriceCents: plan.monthlyPriceCents,
    annualPriceCents: plan.annualPriceCents,
    trialDays: plan.trialDays,
    perSeatPriceCents: plan.perSeatPriceCents,
    perSeatLabel: plan.perSeatLabel,
    stripeMonthlyPriceId: plan.stripeMonthlyPriceId,
    stripeAnnualPriceId: plan.stripeAnnualPriceId,
    stripeProductId: plan.stripeProductId,
    isActive: plan.isActive,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  });
}

/**
 * PATCH /admin/plans/:id - Update a plan.
 */
export async function updatePlan(
  request: FastifyRequest<{ Params: PlanParams; Body: Partial<PlanBody> }>,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params;

  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) {
    return reply.status(404).send({ error: "Plan not found" });
  }

  const plan = await prisma.plan.update({
    where: { id },
    data: request.body,
  });

  return reply.send({
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    role: plan.role,
    tier: plan.tier,
    monthlyPriceCents: plan.monthlyPriceCents,
    annualPriceCents: plan.annualPriceCents,
    trialDays: plan.trialDays,
    perSeatPriceCents: plan.perSeatPriceCents,
    perSeatLabel: plan.perSeatLabel,
    stripeMonthlyPriceId: plan.stripeMonthlyPriceId,
    stripeAnnualPriceId: plan.stripeAnnualPriceId,
    stripeProductId: plan.stripeProductId,
    isActive: plan.isActive,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  });
}

/**
 * DELETE /admin/plans/:id - Soft-delete a plan (set isActive=false).
 */
export async function deletePlan(
  request: FastifyRequest<{ Params: PlanParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params;

  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) {
    return reply.status(404).send({ error: "Plan not found" });
  }

  const plan = await prisma.plan.update({
    where: { id },
    data: { isActive: false },
  });

  return reply.send({
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    isActive: plan.isActive,
  });
}

/**
 * POST /admin/plans/:id/features - Assign a feature to a plan.
 */
export async function assignFeature(
  request: FastifyRequest<{ Params: PlanParams; Body: AssignFeatureBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params;
  const { featureId } = request.body;

  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) {
    return reply.status(404).send({ error: "Plan not found" });
  }

  const feature = await prisma.feature.findUnique({ where: { id: featureId } });
  if (!feature) {
    return reply.status(404).send({ error: "Feature not found" });
  }

  const planFeature = await prisma.planFeature.create({
    data: { planId: id, featureId },
    include: { feature: true },
  });

  return reply.status(201).send({
    planId: id,
    featureId: planFeature.feature.id,
    featureKey: planFeature.feature.key,
    featureName: planFeature.feature.name,
  });
}

/**
 * DELETE /admin/plans/:id/features/:featureId - Remove a feature from a plan.
 */
export async function removeFeature(
  request: FastifyRequest<{ Params: PlanFeatureParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { id, featureId } = request.params;

  const existing = await prisma.planFeature.findUnique({
    where: { planId_featureId: { planId: id, featureId } },
  });
  if (!existing) {
    return reply.status(404).send({ error: "Plan-feature association not found" });
  }

  await prisma.planFeature.delete({
    where: { planId_featureId: { planId: id, featureId } },
  });

  return reply.status(204).send();
}

/**
 * GET /admin/plans/matrix - Full feature matrix: all features grouped by
 * category, with each plan's inclusion status.
 */
export async function getMatrix(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const [features, plans] = await Promise.all([
    prisma.feature.findMany({
      include: { plans: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ role: "asc" }, { tier: "asc" }],
    }),
  ]);

  // Build a set of featureId per plan for quick lookup
  const planFeatureMap = new Map<number, Set<number>>();
  for (const feature of features) {
    for (const pf of feature.plans) {
      if (!planFeatureMap.has(pf.planId)) {
        planFeatureMap.set(pf.planId, new Set());
      }
      planFeatureMap.get(pf.planId)!.add(pf.featureId);
    }
  }

  // Group features by category
  const categoryMap = new Map<string, typeof features>();
  for (const feature of features) {
    if (!categoryMap.has(feature.category)) {
      categoryMap.set(feature.category, []);
    }
    categoryMap.get(feature.category)!.push(feature);
  }

  const categories = Array.from(categoryMap.entries()).map(
    ([category, categoryFeatures]) => ({
      category,
      features: categoryFeatures.map((f) => ({
        id: f.id,
        key: f.key,
        name: f.name,
        description: f.description,
        roles: f.roles,
        plans: plans.map((p) => ({
          planId: p.id,
          included: planFeatureMap.get(p.id)?.has(f.id) ?? false,
        })),
      })),
    }),
  );

  return reply.send({
    plans: plans.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      role: p.role,
      tier: p.tier,
    })),
    categories,
  });
}
