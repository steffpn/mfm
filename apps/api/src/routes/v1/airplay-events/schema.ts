import { Type, type Static } from "@sinclair/typebox";

// --- Request Schemas ---

export const AirplayEventParamsSchema = Type.Object({
  id: Type.Number(),
});

export type AirplayEventParams = Static<typeof AirplayEventParamsSchema>;

// --- Response Schemas ---

export const SnippetUrlResponseSchema = Type.Object({
  url: Type.String(),
  expiresIn: Type.Number(),
});

export const ErrorResponseSchema = Type.Object({
  error: Type.String(),
});
