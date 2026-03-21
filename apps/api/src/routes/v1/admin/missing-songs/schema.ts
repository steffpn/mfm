import { Type, type Static } from "@sinclair/typebox";

export const CreateMissingSongSchema = Type.Object({
  songTitle: Type.String({ minLength: 1 }),
  artistName: Type.String({ minLength: 1 }),
  isrc: Type.Optional(Type.String()),
  youtubeUrl: Type.Optional(Type.String()),
  spotifyUrl: Type.Optional(Type.String()),
  notes: Type.Optional(Type.String()),
});

export type CreateMissingSongBody = Static<typeof CreateMissingSongSchema>;

export const UpdateMissingSongSchema = Type.Object({
  status: Type.Union([
    Type.Literal("pending"),
    Type.Literal("submitted"),
    Type.Literal("resolved"),
  ]),
});

export type UpdateMissingSongBody = Static<typeof UpdateMissingSongSchema>;

export const MissingSongParamsSchema = Type.Object({
  id: Type.Number(),
});

export type MissingSongParams = Static<typeof MissingSongParamsSchema>;

export const ListMissingSongsQuerySchema = Type.Object({
  status: Type.Optional(Type.String()),
  cursor: Type.Optional(Type.Number()),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
});

export type ListMissingSongsQuery = Static<typeof ListMissingSongsQuerySchema>;
