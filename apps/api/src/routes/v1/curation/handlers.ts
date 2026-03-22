import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../../lib/prisma.js";
import type {
  StationParam,
  VoteBody,
  SongParam,
  AddCurationSongBody,
  ScoresQuery,
} from "./schema.js";

/**
 * GET /curation/stations - List stations that have curation enabled (have songs).
 * Public endpoint — no auth required.
 */
export async function listCurationStations(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const stations = await prisma.station.findMany({
    where: {
      curationSongs: { some: { isActive: true } },
    },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      country: true,
      _count: { select: { curationSongs: { where: { isActive: true } } } },
    },
  });

  return reply.send(
    stations.map((s) => ({
      id: s.id,
      name: s.name,
      logoUrl: s.logoUrl,
      country: s.country,
      songCount: s._count.curationSongs,
    })),
  );
}

/**
 * GET /curation/stations/:stationId/next - Get the next song to vote on.
 * Public endpoint — no auth required.
 * Uses sessionToken query param to exclude already-voted songs.
 */
export async function getNextSong(
  request: FastifyRequest<{ Params: StationParam; Querystring: { sessionToken?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const { stationId } = request.params;
  const sessionToken = request.query.sessionToken;

  // Get a random song the user hasn't voted on yet
  let excludeIds: number[] = [];
  if (sessionToken) {
    const voted = await prisma.curationVote.findMany({
      where: { sessionToken },
      select: { curationSongId: true },
    });
    excludeIds = voted.map((v) => v.curationSongId);
  }

  const songs = await prisma.curationSong.findMany({
    where: {
      stationId,
      isActive: true,
      ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
    },
    include: {
      score: true,
    },
  });

  if (songs.length === 0) {
    return reply.send({ song: null, remaining: 0 });
  }

  // Pick a random song
  const song = songs[Math.floor(Math.random() * songs.length)];

  return reply.send({
    song: {
      id: song.id,
      songTitle: song.songTitle,
      artistName: song.artistName,
      isrc: song.isrc,
      previewUrl: song.previewUrl,
      coverUrl: song.coverUrl,
      artistPictureUrl: song.artistPictureUrl,
      deezerTrackId: song.deezerTrackId,
    },
    remaining: songs.length - 1,
  });
}

/**
 * POST /curation/vote - Submit a vote (keeper/skipper).
 * Public endpoint — uses sessionToken for anonymous identity.
 */
export async function submitVote(
  request: FastifyRequest<{ Body: VoteBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { curationSongId, vote, sessionToken } = request.body;

  // Check song exists
  const song = await prisma.curationSong.findUnique({
    where: { id: curationSongId },
  });
  if (!song || !song.isActive) {
    return reply.status(404).send({ error: "Song not found" });
  }

  // Upsert vote (one vote per session per song)
  await prisma.curationVote.upsert({
    where: {
      curationSongId_sessionToken: { curationSongId, sessionToken },
    },
    update: { vote, votedAt: new Date() },
    create: { curationSongId, sessionToken, vote },
  });

  // Recalculate score
  const [keeperResult, skipperResult] = await Promise.all([
    prisma.curationVote.count({
      where: { curationSongId, vote: "keeper" },
    }),
    prisma.curationVote.count({
      where: { curationSongId, vote: "skipper" },
    }),
  ]);

  const total = keeperResult + skipperResult;
  const score = total > 0 ? (keeperResult / total) * 100 : 0;

  await prisma.curationScore.upsert({
    where: { curationSongId },
    update: { keeperCount: keeperResult, skipperCount: skipperResult, score },
    create: { curationSongId, keeperCount: keeperResult, skipperCount: skipperResult, score },
  });

  return reply.send({
    vote,
    score: { keeperCount: keeperResult, skipperCount: skipperResult, score: Math.round(score) },
  });
}

/**
 * GET /curation/scores - Get scores/leaderboard for a station.
 * Public endpoint.
 */
export async function getScores(
  request: FastifyRequest<{ Querystring: ScoresQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { stationId, limit = 20 } = request.query;

  const scores = await prisma.curationScore.findMany({
    where: {
      curationSong: { stationId, isActive: true },
    },
    include: {
      curationSong: {
        select: {
          id: true,
          songTitle: true,
          artistName: true,
          coverUrl: true,
          artistPictureUrl: true,
          previewUrl: true,
        },
      },
    },
    orderBy: { score: "desc" },
    take: limit,
  });

  return reply.send(
    scores.map((s, i) => ({
      rank: i + 1,
      song: s.curationSong,
      keeperCount: s.keeperCount,
      skipperCount: s.skipperCount,
      score: Math.round(s.score),
      totalVotes: s.keeperCount + s.skipperCount,
    })),
  );
}

// ─── Station-managed endpoints (require auth) ──────────────────────

/**
 * POST /curation/stations/:stationId/songs - Add a song to curation.
 * Requires STATION or ADMIN role.
 */
export async function addCurationSong(
  request: FastifyRequest<{ Params: StationParam; Body: AddCurationSongBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { stationId } = request.params;
  const data = request.body;

  const station = await prisma.station.findUnique({ where: { id: stationId } });
  if (!station) {
    return reply.status(404).send({ error: "Station not found" });
  }

  const song = await prisma.curationSong.create({
    data: {
      stationId,
      songTitle: data.songTitle,
      artistName: data.artistName,
      isrc: data.isrc,
      deezerTrackId: data.deezerTrackId,
      previewUrl: data.previewUrl,
      coverUrl: data.coverUrl,
      artistPictureUrl: data.artistPictureUrl,
      source: data.source || "manual",
    },
  });

  return reply.status(201).send(song);
}

/**
 * DELETE /curation/songs/:id - Remove a song from curation (deactivate).
 * Requires STATION or ADMIN role.
 */
export async function removeCurationSong(
  request: FastifyRequest<{ Params: SongParam }>,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params;

  const song = await prisma.curationSong.findUnique({ where: { id } });
  if (!song) {
    return reply.status(404).send({ error: "Curation song not found" });
  }

  await prisma.curationSong.update({
    where: { id },
    data: { isActive: false },
  });

  return reply.send({ success: true });
}

/**
 * GET /curation/stations/:stationId/songs - List all curation songs for a station.
 * Requires STATION or ADMIN role.
 */
export async function listCurationSongs(
  request: FastifyRequest<{ Params: StationParam }>,
  reply: FastifyReply,
): Promise<void> {
  const { stationId } = request.params;

  const songs = await prisma.curationSong.findMany({
    where: { stationId },
    include: { score: true },
    orderBy: { createdAt: "desc" },
  });

  return reply.send(
    songs.map((s) => ({
      id: s.id,
      songTitle: s.songTitle,
      artistName: s.artistName,
      isrc: s.isrc,
      previewUrl: s.previewUrl,
      coverUrl: s.coverUrl,
      artistPictureUrl: s.artistPictureUrl,
      source: s.source,
      isActive: s.isActive,
      score: s.score
        ? {
            keeperCount: s.score.keeperCount,
            skipperCount: s.score.skipperCount,
            score: Math.round(s.score.score),
            totalVotes: s.score.keeperCount + s.score.skipperCount,
          }
        : null,
      createdAt: s.createdAt,
    })),
  );
}

/**
 * POST /curation/stations/:stationId/sync-rotation - Sync curation songs from airplay rotation.
 * Pulls top songs from the station's recent airplay and adds them to curation.
 * Requires STATION or ADMIN role.
 */
export async function syncFromRotation(
  request: FastifyRequest<{ Params: StationParam }>,
  reply: FastifyReply,
): Promise<void> {
  const { stationId } = request.params;

  // Get top 50 songs from last 7 days
  const topSongs = await prisma.$queryRaw<
    Array<{
      song_title: string;
      artist_name: string;
      isrc: string | null;
    }>
  >`
    SELECT song_title, artist_name, isrc
    FROM (
      SELECT song_title, artist_name, isrc, COUNT(*) AS play_count,
        ROW_NUMBER() OVER (PARTITION BY isrc ORDER BY COUNT(*) DESC) AS rn
      FROM airplay_events
      WHERE station_id = ${stationId}
        AND started_at >= CURRENT_DATE - INTERVAL '7 days'
        AND isrc IS NOT NULL
      GROUP BY song_title, artist_name, isrc
    ) ranked
    WHERE rn = 1
    ORDER BY play_count DESC
    LIMIT 50
  `;

  let added = 0;
  for (const song of topSongs) {
    if (!song.isrc) continue;

    // Skip if already exists
    const existing = await prisma.curationSong.findUnique({
      where: { stationId_isrc: { stationId, isrc: song.isrc } },
    });
    if (existing) continue;

    await prisma.curationSong.create({
      data: {
        stationId,
        songTitle: song.song_title,
        artistName: song.artist_name,
        isrc: song.isrc,
        source: "rotation",
      },
    });
    added++;
  }

  return reply.send({ synced: added, total: topSongs.length });
}
