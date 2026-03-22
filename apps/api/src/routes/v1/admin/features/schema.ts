import { Type, type Static } from "@sinclair/typebox";

// --- Request Param Schemas ---

export const FeatureParamsSchema = Type.Object({
  id: Type.Number(),
});

export type FeatureParams = Static<typeof FeatureParamsSchema>;

// --- Request Body Schemas ---

export const FeatureBodySchema = Type.Object({
  key: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  description: Type.String(),
  category: Type.String({ minLength: 1 }),
  roles: Type.Array(Type.String({ minLength: 1 })),
});

export type FeatureBody = Static<typeof FeatureBodySchema>;
