import { Type, type Static } from "@sinclair/typebox";

// --- Request Body Schemas ---

export const AddArtistBodySchema = Type.Object({
  artistName: Type.String({ minLength: 1 }),
});

export type AddArtistBody = Static<typeof AddArtistBodySchema>;

export const ArtistIdParamsSchema = Type.Object({
  id: Type.Number(),
});

export type ArtistIdParams = Static<typeof ArtistIdParamsSchema>;

export const ToggleSongBodySchema = Type.Object({
  songTitle: Type.String(),
  artistName: Type.String(),
  isrc: Type.String(),
  enabled: Type.Boolean(),
});

export type ToggleSongBody = Static<typeof ToggleSongBodySchema>;

export const ComparisonQuerySchema = Type.Object({
  artistIds: Type.String(),
  period: Type.Optional(
    Type.Union([Type.Literal("week"), Type.Literal("month")]),
  ),
});

export type ComparisonQuery = Static<typeof ComparisonQuerySchema>;

export const SongIdParamsSchema = Type.Object({
  id: Type.Number(),
});

export type SongIdParams = Static<typeof SongIdParamsSchema>;

export const PeriodQuerySchema = Type.Object({
  period: Type.Optional(
    Type.Union([
      Type.Literal("day"),
      Type.Literal("week"),
      Type.Literal("month"),
    ]),
  ),
});

export type PeriodQuery = Static<typeof PeriodQuerySchema>;

export const BrowseArtistsQuerySchema = Type.Object({
  q: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
});

export type BrowseArtistsQuery = Static<typeof BrowseArtistsQuerySchema>;
