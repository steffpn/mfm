import { Type, type Static } from "@sinclair/typebox";

export const LiveFeedQuerySchema = Type.Object({
  token: Type.String(),
});

export type LiveFeedQuery = Static<typeof LiveFeedQuerySchema>;
