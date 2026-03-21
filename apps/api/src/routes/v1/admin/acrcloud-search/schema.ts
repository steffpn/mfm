import { Type, type Static } from "@sinclair/typebox";

export const AcrcloudSearchQuerySchema = Type.Object({
  q: Type.String({ minLength: 1 }),
  type: Type.Optional(
    Type.Union([
      Type.Literal("track"),
      Type.Literal("artist"),
      Type.Literal("album"),
    ]),
  ),
});

export type AcrcloudSearchQuery = Static<typeof AcrcloudSearchQuerySchema>;
