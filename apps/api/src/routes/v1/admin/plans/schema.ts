import { Type, type Static } from "@sinclair/typebox";

// --- Request Param Schemas ---

export const PlanParamsSchema = Type.Object({
  id: Type.Number(),
});

export type PlanParams = Static<typeof PlanParamsSchema>;

export const PlanFeatureParamsSchema = Type.Object({
  id: Type.Number(),
  featureId: Type.Number(),
});

export type PlanFeatureParams = Static<typeof PlanFeatureParamsSchema>;

// --- Request Body Schemas ---

export const PlanBodySchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
  role: Type.String({ minLength: 1 }),
  tier: Type.String({ minLength: 1 }),
  monthlyPriceCents: Type.Number(),
  annualPriceCents: Type.Number(),
  trialDays: Type.Number(),
  perSeatPriceCents: Type.Number(),
  perSeatLabel: Type.Optional(Type.String()),
  stripeMonthlyPriceId: Type.Optional(Type.String()),
  stripeAnnualPriceId: Type.Optional(Type.String()),
  stripeProductId: Type.Optional(Type.String()),
});

export type PlanBody = Static<typeof PlanBodySchema>;

export const AssignFeatureBodySchema = Type.Object({
  featureId: Type.Number(),
});

export type AssignFeatureBody = Static<typeof AssignFeatureBodySchema>;
