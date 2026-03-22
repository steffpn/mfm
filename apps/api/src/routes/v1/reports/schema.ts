import { Type, type Static } from "@sinclair/typebox";

export const ReportQuerySchema = Type.Object({
  from: Type.Optional(Type.String({ format: "date" })),
  to: Type.Optional(Type.String({ format: "date" })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 30, default: 7 })),
});
export type ReportQuery = Static<typeof ReportQuerySchema>;
