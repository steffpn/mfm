import { Type, type Static } from "@sinclair/typebox";

export const ChartAlertQuerySchema = Type.Object({
  unreadOnly: Type.Optional(Type.Boolean()),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 50, default: 20 })),
});
export type ChartAlertQuery = Static<typeof ChartAlertQuerySchema>;

export const MarkReadSchema = Type.Object({
  alertIds: Type.Array(Type.Number()),
});
export type MarkReadBody = Static<typeof MarkReadSchema>;
