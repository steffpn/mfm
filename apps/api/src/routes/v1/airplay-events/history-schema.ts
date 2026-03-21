import { Type, type Static } from "@sinclair/typebox";

export const SongHistoryQuerySchema = Type.Object({
  isrc: Type.Optional(Type.String()),
  songTitle: Type.Optional(Type.String()),
  artistName: Type.Optional(Type.String()),
  stationId: Type.Optional(Type.Number()),
  startDate: Type.Optional(Type.String({ format: "date" })),
  endDate: Type.Optional(Type.String({ format: "date" })),
  cursor: Type.Optional(Type.Number()),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 200 })),
});

export type SongHistoryQuery = Static<typeof SongHistoryQuerySchema>;
