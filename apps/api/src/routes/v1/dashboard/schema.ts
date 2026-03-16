import { Type, type Static } from "@sinclair/typebox";

// --- Request Schemas ---

export const DashboardSummaryQuerySchema = Type.Object({
  period: Type.Optional(
    Type.Union([
      Type.Literal("day"),
      Type.Literal("week"),
      Type.Literal("month"),
    ]),
  ),
});

export type DashboardSummaryQuery = Static<typeof DashboardSummaryQuerySchema>;

export const TopStationsQuerySchema = Type.Object({
  period: Type.Optional(
    Type.Union([
      Type.Literal("day"),
      Type.Literal("week"),
      Type.Literal("month"),
    ]),
  ),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 50 })),
});

export type TopStationsQuery = Static<typeof TopStationsQuerySchema>;

// --- Response Schemas ---

export const DashboardBucketSchema = Type.Object({
  bucket: Type.String(),
  playCount: Type.Number(),
  uniqueSongs: Type.Number(),
  uniqueArtists: Type.Number(),
});

export const DashboardTotalsSchema = Type.Object({
  playCount: Type.Number(),
  uniqueSongs: Type.Number(),
  uniqueArtists: Type.Number(),
});

export const DashboardSummaryResponseSchema = Type.Object({
  buckets: Type.Array(DashboardBucketSchema),
  totals: DashboardTotalsSchema,
});

export const TopStationSchema = Type.Object({
  stationId: Type.Number(),
  stationName: Type.String(),
  playCount: Type.Number(),
});

export const TopStationsResponseSchema = Type.Object({
  stations: Type.Array(TopStationSchema),
});

export const ErrorResponseSchema = Type.Object({
  error: Type.String(),
});
