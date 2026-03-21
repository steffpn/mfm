import { Type, type Static } from "@sinclair/typebox";

// --- Request Params ---

export const SongIdParamsSchema = Type.Object({
  id: Type.Number(),
});

export type SongIdParams = Static<typeof SongIdParamsSchema>;

// --- Request Body ---

export const AddMonitoredSongSchema = Type.Object({
  songTitle: Type.String(),
  artistName: Type.String(),
  isrc: Type.String(),
});

export type AddMonitoredSongBody = Static<typeof AddMonitoredSongSchema>;

// --- Query Schemas ---

export const PeriodQuerySchema = Type.Object({
  period: Type.Optional(
    Type.Union([
      Type.Literal("day"),
      Type.Literal("week"),
      Type.Literal("month"),
    ]),
  ),
  startDate: Type.Optional(Type.String()),
  endDate: Type.Optional(Type.String()),
});

export type PeriodQuery = Static<typeof PeriodQuerySchema>;

export const SongAnalyticsQuerySchema = Type.Object({
  period: Type.Optional(
    Type.Union([
      Type.Literal("day"),
      Type.Literal("week"),
      Type.Literal("month"),
    ]),
  ),
  startDate: Type.Optional(Type.String()),
  endDate: Type.Optional(Type.String()),
});

export type SongAnalyticsQuery = Static<typeof SongAnalyticsQuerySchema>;
