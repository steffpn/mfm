import { Type, type Static } from "@sinclair/typebox";

// --- Request Schemas ---

export const StationCreateSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  streamUrl: Type.String({ format: "uri" }),
  stationType: Type.Union([Type.Literal("radio"), Type.Literal("tv")]),
  country: Type.Optional(Type.String({ default: "RO" })),
});

export type StationCreateBody = Static<typeof StationCreateSchema>;

export const StationBulkCreateSchema = Type.Array(StationCreateSchema, {
  minItems: 1,
});

export type StationBulkCreateBody = Static<typeof StationBulkCreateSchema>;

export const StationUpdateSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  streamUrl: Type.Optional(Type.String({ format: "uri" })),
  stationType: Type.Optional(
    Type.Union([Type.Literal("radio"), Type.Literal("tv")]),
  ),
});

export type StationUpdateBody = Static<typeof StationUpdateSchema>;

export const StationParamsSchema = Type.Object({
  id: Type.Number(),
});

export type StationParams = Static<typeof StationParamsSchema>;

// --- Response Schemas ---

export const StationResponseSchema = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  streamUrl: Type.String(),
  stationType: Type.String(),
  country: Type.String(),
  status: Type.String(),
  lastHeartbeat: Type.Union([Type.String(), Type.Null()]),
  restartCount: Type.Number(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});
