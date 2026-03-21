import { Type, type Static } from "@sinclair/typebox";

// --- Request Schemas ---

export const PeriodQuerySchema = Type.Object({
  period: Type.Optional(
    Type.Union([
      Type.Literal("day"),
      Type.Literal("week"),
      Type.Literal("month"),
    ]),
  ),
  startDate: Type.Optional(Type.String({ format: "date" })),
  endDate: Type.Optional(Type.String({ format: "date" })),
});

export type PeriodQuery = Static<typeof PeriodQuerySchema>;

export const StationIdParamsSchema = Type.Object({
  stationId: Type.Number(),
});

export type StationIdParams = Static<typeof StationIdParamsSchema>;

export const TopSongsQuerySchema = Type.Object({
  period: Type.Optional(
    Type.Union([
      Type.Literal("day"),
      Type.Literal("week"),
      Type.Literal("month"),
    ]),
  ),
  startDate: Type.Optional(Type.String({ format: "date" })),
  endDate: Type.Optional(Type.String({ format: "date" })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
});

export type TopSongsQuery = Static<typeof TopSongsQuerySchema>;

export const StationIdQuerySchema = Type.Object({
  period: Type.Optional(
    Type.Union([
      Type.Literal("day"),
      Type.Literal("week"),
      Type.Literal("month"),
    ]),
  ),
  startDate: Type.Optional(Type.String({ format: "date" })),
  endDate: Type.Optional(Type.String({ format: "date" })),
  stationId: Type.Optional(Type.Number()),
});

export type StationIdQuery = Static<typeof StationIdQuerySchema>;

export const CompetitorIdParamsSchema = Type.Object({
  competitorId: Type.Number(),
});

export type CompetitorIdParams = Static<typeof CompetitorIdParamsSchema>;
