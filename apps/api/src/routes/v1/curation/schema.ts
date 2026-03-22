import { Type, type Static } from "@sinclair/typebox";

export const StationParamSchema = Type.Object({
  stationId: Type.Number(),
});
export type StationParam = Static<typeof StationParamSchema>;

export const VoteBodySchema = Type.Object({
  curationSongId: Type.Number(),
  vote: Type.Union([Type.Literal("keeper"), Type.Literal("skipper")]),
  sessionToken: Type.String({ minLength: 8 }),
});
export type VoteBody = Static<typeof VoteBodySchema>;

export const SongParamSchema = Type.Object({
  id: Type.Number(),
});
export type SongParam = Static<typeof SongParamSchema>;

export const AddCurationSongSchema = Type.Object({
  songTitle: Type.String(),
  artistName: Type.String(),
  isrc: Type.Optional(Type.String()),
  deezerTrackId: Type.Optional(Type.String()),
  previewUrl: Type.Optional(Type.String()),
  coverUrl: Type.Optional(Type.String()),
  artistPictureUrl: Type.Optional(Type.String()),
  source: Type.Optional(Type.Union([Type.Literal("rotation"), Type.Literal("manual")])),
});
export type AddCurationSongBody = Static<typeof AddCurationSongSchema>;

export const ScoresQuerySchema = Type.Object({
  stationId: Type.Number(),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
});
export type ScoresQuery = Static<typeof ScoresQuerySchema>;
