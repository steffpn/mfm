import type { FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "../../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import type {
  PeriodQuery,
  TopSongsQuery,
  StationIdQuery,
  CompetitorIdParams,
} from "./schema.js";

/**
 * Derive a date range from the period string, or from explicit start/end dates.
 */
function getDateRange(query: {
  period?: string;
  startDate?: string;
  endDate?: string;
}): { start: Date; end: Date } {
  if (query.startDate) {
    const start = new Date(query.startDate);
    start.setHours(0, 0, 0, 0);
    const end = query.endDate ? new Date(query.endDate) : new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  const end = new Date();
  const start = new Date();
  switch (query.period) {
    case "month":
      start.setDate(start.getDate() - 30);
      break;
    case "week":
      start.setDate(start.getDate() - 7);
      break;
    case "day":
    default:
      start.setDate(start.getDate() - 1);
      break;
  }
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

/**
 * Extract own station IDs from the current user's scopes.
 */
function getOwnStationIds(request: FastifyRequest): number[] {
  return request.currentUser.scopes
    .filter((s) => s.entityType === "STATION")
    .map((s) => s.entityId);
}

/**
 * GET /station/overview
 *
 * Total plays, unique songs, unique artists for the user's own station(s)
 * within the requested period.
 */
export async function getStationOverview(
  request: FastifyRequest<{ Querystring: PeriodQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const ownStationIds = getOwnStationIds(request);
  if (ownStationIds.length === 0) {
    return reply.send({
      totalPlays: 0,
      uniqueSongs: 0,
      uniqueArtists: 0,
      stationNames: [],
    });
  }

  const { start, end } = getDateRange(request.query);

  const [stats] = await prisma.$queryRaw<
    Array<{
      plays: bigint | number;
      unique_songs: bigint | number;
      unique_artists: bigint | number;
    }>
  >`
    SELECT
      COUNT(*)::int AS plays,
      COUNT(DISTINCT isrc)::int AS unique_songs,
      COUNT(DISTINCT artist_name)::int AS unique_artists
    FROM airplay_events
    WHERE station_id IN (${Prisma.join(ownStationIds)})
      AND started_at >= ${start}
      AND started_at <= ${end}
  `;

  const stations = await prisma.station.findMany({
    where: { id: { in: ownStationIds } },
    select: { name: true },
  });

  return reply.send({
    totalPlays: Number(stats?.plays ?? 0),
    uniqueSongs: Number(stats?.unique_songs ?? 0),
    uniqueArtists: Number(stats?.unique_artists ?? 0),
    stationNames: stations.map((s) => s.name),
  });
}

/**
 * GET /station/top-songs
 *
 * Ranked songs by play count on the user's own station(s).
 */
export async function getStationTopSongs(
  request: FastifyRequest<{ Querystring: TopSongsQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const ownStationIds = getOwnStationIds(request);
  if (ownStationIds.length === 0) {
    return reply.send([]);
  }

  const { start, end } = getDateRange(request.query);
  const limit = request.query.limit ?? 20;

  const rows = await prisma.$queryRaw<
    Array<{
      song_title: string;
      artist_name: string;
      isrc: string | null;
      play_count: bigint | number;
    }>
  >`
    SELECT
      song_title,
      artist_name,
      isrc,
      COUNT(*)::int AS play_count
    FROM airplay_events
    WHERE station_id IN (${Prisma.join(ownStationIds)})
      AND started_at >= ${start}
      AND started_at <= ${end}
    GROUP BY song_title, artist_name, isrc
    ORDER BY play_count DESC
    LIMIT ${limit}
  `;

  const result = rows.map((r, i) => ({
    rank: i + 1,
    songTitle: r.song_title,
    artistName: r.artist_name,
    isrc: r.isrc,
    playCount: Number(r.play_count),
  }));

  return reply.send(result);
}

/**
 * GET /station/new-songs?stationId=X
 *
 * Songs whose first-ever appearance on the given station was within the period.
 * stationId can be the user's own or a competitor station.
 */
export async function getNewSongs(
  request: FastifyRequest<{ Querystring: StationIdQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const ownStationIds = getOwnStationIds(request);
  const stationId = request.query.stationId ?? ownStationIds[0];

  if (!stationId) {
    return reply.code(400).send({ error: "No stationId provided and no own station found" });
  }

  const { start, end } = getDateRange(request.query);

  const rows = await prisma.$queryRaw<
    Array<{
      song_title: string;
      artist_name: string;
      isrc: string | null;
      first_played: Date;
    }>
  >`
    SELECT
      ae.song_title,
      ae.artist_name,
      ae.isrc,
      MIN(ae.started_at) AS first_played
    FROM airplay_events ae
    WHERE ae.station_id = ${stationId}
    GROUP BY ae.song_title, ae.artist_name, ae.isrc
    HAVING MIN(ae.started_at) >= ${start}
      AND MIN(ae.started_at) <= ${end}
    ORDER BY first_played DESC
  `;

  const result = rows.map((r) => ({
    songTitle: r.song_title,
    artistName: r.artist_name,
    isrc: r.isrc,
    firstPlayedAt:
      r.first_played instanceof Date
        ? r.first_played.toISOString()
        : String(r.first_played),
  }));

  return reply.send(result);
}

/**
 * GET /station/exclusive-songs?stationId=X
 *
 * Songs played on stationId but NOT on any other monitored station in the period.
 */
export async function getExclusiveSongs(
  request: FastifyRequest<{ Querystring: StationIdQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const ownStationIds = getOwnStationIds(request);
  const stationId = request.query.stationId ?? ownStationIds[0];

  if (!stationId) {
    return reply.code(400).send({ error: "No stationId provided and no own station found" });
  }

  const { start, end } = getDateRange(request.query);

  const rows = await prisma.$queryRaw<
    Array<{
      song_title: string;
      artist_name: string;
      isrc: string | null;
      play_count: bigint | number;
    }>
  >`
    SELECT
      ae.song_title,
      ae.artist_name,
      ae.isrc,
      COUNT(*)::int AS play_count
    FROM airplay_events ae
    WHERE ae.station_id = ${stationId}
      AND ae.started_at >= ${start}
      AND ae.started_at <= ${end}
      AND NOT EXISTS (
        SELECT 1 FROM airplay_events ae2
        WHERE ae2.isrc = ae.isrc
          AND ae2.isrc IS NOT NULL
          AND ae2.station_id != ${stationId}
          AND ae2.started_at >= ${start}
          AND ae2.started_at <= ${end}
      )
    GROUP BY ae.song_title, ae.artist_name, ae.isrc
    ORDER BY play_count DESC
    LIMIT 50
  `;

  const result = rows.map((r) => ({
    songTitle: r.song_title,
    artistName: r.artist_name,
    isrc: r.isrc,
    playCount: Number(r.play_count),
  }));

  return reply.send(result);
}

/**
 * GET /station/overlap/:competitorId
 *
 * Jaccard similarity between own station(s) and a competitor station.
 * Returns overlap percentage and shared songs list.
 */
export async function getPlaylistOverlap(
  request: FastifyRequest<{
    Params: CompetitorIdParams;
    Querystring: PeriodQuery;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const ownStationIds = getOwnStationIds(request);
  const competitorId = Number(request.params.competitorId);

  if (ownStationIds.length === 0) {
    return reply.send({
      overlapPercent: 0,
      sharedCount: 0,
      exclusiveToYou: 0,
      exclusiveToThem: 0,
      sharedSongs: [],
    });
  }

  const { start, end } = getDateRange(request.query);

  // Get ISRCs for own stations
  const ownIsrcs = await prisma.$queryRaw<Array<{ isrc: string }>>`
    SELECT DISTINCT isrc
    FROM airplay_events
    WHERE station_id IN (${Prisma.join(ownStationIds)})
      AND started_at >= ${start}
      AND started_at <= ${end}
      AND isrc IS NOT NULL
  `;

  // Get ISRCs for competitor station
  const competitorIsrcs = await prisma.$queryRaw<Array<{ isrc: string }>>`
    SELECT DISTINCT isrc
    FROM airplay_events
    WHERE station_id = ${competitorId}
      AND started_at >= ${start}
      AND started_at <= ${end}
      AND isrc IS NOT NULL
  `;

  const ownSet = new Set(ownIsrcs.map((r) => r.isrc));
  const competitorSet = new Set(competitorIsrcs.map((r) => r.isrc));

  const intersection = new Set([...ownSet].filter((x) => competitorSet.has(x)));
  const union = new Set([...ownSet, ...competitorSet]);

  const overlapPercent =
    union.size > 0
      ? Math.round((intersection.size / union.size) * 10000) / 100
      : 0;

  const sharedIsrcs = [...intersection];
  const exclusiveToYou = ownSet.size - intersection.size;
  const exclusiveToThem = competitorSet.size - intersection.size;

  // Get shared songs details (top 20 by combined plays)
  let sharedSongs: Array<{
    songTitle: string;
    artistName: string;
    yourPlays: number;
    theirPlays: number;
  }> = [];

  if (sharedIsrcs.length > 0) {
    const sharedRows = await prisma.$queryRaw<
      Array<{
        song_title: string;
        artist_name: string;
        your_plays: bigint | number;
        their_plays: bigint | number;
      }>
    >`
      SELECT
        song_title,
        artist_name,
        SUM(CASE WHEN station_id IN (${Prisma.join(ownStationIds)}) THEN 1 ELSE 0 END)::int AS your_plays,
        SUM(CASE WHEN station_id = ${competitorId} THEN 1 ELSE 0 END)::int AS their_plays
      FROM airplay_events
      WHERE isrc IN (${Prisma.join(sharedIsrcs)})
        AND (station_id IN (${Prisma.join(ownStationIds)}) OR station_id = ${competitorId})
        AND started_at >= ${start}
        AND started_at <= ${end}
      GROUP BY song_title, artist_name
      ORDER BY (SUM(CASE WHEN station_id IN (${Prisma.join(ownStationIds)}) THEN 1 ELSE 0 END)
              + SUM(CASE WHEN station_id = ${competitorId} THEN 1 ELSE 0 END)) DESC
      LIMIT 20
    `;

    sharedSongs = sharedRows.map((r) => ({
      songTitle: r.song_title,
      artistName: r.artist_name,
      yourPlays: Number(r.your_plays),
      theirPlays: Number(r.their_plays),
    }));
  }

  return reply.send({
    overlapPercent,
    sharedCount: intersection.size,
    exclusiveToYou,
    exclusiveToThem,
    sharedSongs,
  });
}

/**
 * GET /station/genre-distribution
 *
 * Distribution of record labels (as a genre proxy) on the user's own station(s).
 */
export async function getGenreDistribution(
  request: FastifyRequest<{ Querystring: PeriodQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const ownStationIds = getOwnStationIds(request);
  if (ownStationIds.length === 0) {
    return reply.send([]);
  }

  const { start, end } = getDateRange(request.query);

  const rows = await prisma.$queryRaw<
    Array<{ label: string; play_count: bigint | number }>
  >`
    SELECT
      label,
      COUNT(*)::int AS play_count
    FROM airplay_events
    WHERE station_id IN (${Prisma.join(ownStationIds)})
      AND started_at >= ${start}
      AND started_at <= ${end}
      AND label IS NOT NULL
    GROUP BY label
    ORDER BY play_count DESC
  `;

  const totalPlays = rows.reduce((sum, r) => sum + Number(r.play_count), 0);

  const result = rows.map((r) => ({
    label: r.label,
    playCount: Number(r.play_count),
    percentage:
      totalPlays > 0
        ? Math.round((Number(r.play_count) / totalPlays) * 10000) / 100
        : 0,
  }));

  return reply.send(result);
}

/**
 * GET /station/rotation
 *
 * Rotation analysis: unique songs per hour, average rotation,
 * and over-rotated songs (> mean + 2*stddev).
 */
export async function getRotationAnalysis(
  request: FastifyRequest<{ Querystring: PeriodQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const ownStationIds = getOwnStationIds(request);
  if (ownStationIds.length === 0) {
    return reply.send({
      uniqueSongsPerHour: [],
      averageRotation: 0,
      overRotatedSongs: [],
    });
  }

  const { start, end } = getDateRange(request.query);

  // Unique songs per hour of day
  const hourlyRows = await prisma.$queryRaw<
    Array<{ hour: number; count: bigint | number }>
  >`
    SELECT
      EXTRACT(hour FROM started_at)::int AS hour,
      COUNT(DISTINCT isrc)::int AS count
    FROM airplay_events
    WHERE station_id IN (${Prisma.join(ownStationIds)})
      AND started_at >= ${start}
      AND started_at <= ${end}
      AND isrc IS NOT NULL
    GROUP BY EXTRACT(hour FROM started_at)
    ORDER BY hour ASC
  `;

  // Per-song play counts for rotation stats
  const songCounts = await prisma.$queryRaw<
    Array<{
      song_title: string;
      artist_name: string;
      isrc: string | null;
      play_count: bigint | number;
    }>
  >`
    SELECT
      song_title,
      artist_name,
      isrc,
      COUNT(*)::int AS play_count
    FROM airplay_events
    WHERE station_id IN (${Prisma.join(ownStationIds)})
      AND started_at >= ${start}
      AND started_at <= ${end}
    GROUP BY song_title, artist_name, isrc
  `;

  const counts = songCounts.map((r) => Number(r.play_count));
  const n = counts.length;
  const mean = n > 0 ? counts.reduce((a, b) => a + b, 0) / n : 0;
  const variance =
    n > 0 ? counts.reduce((sum, c) => sum + (c - mean) ** 2, 0) / n : 0;
  const stddev = Math.sqrt(variance);
  const threshold = mean + 2 * stddev;

  const overRotated = songCounts
    .filter((r) => Number(r.play_count) > threshold)
    .sort((a, b) => Number(b.play_count) - Number(a.play_count))
    .map((r) => ({
      songTitle: r.song_title,
      artistName: r.artist_name,
      playCount: Number(r.play_count),
      expectedMax: Math.round(threshold),
    }));

  return reply.send({
    uniqueSongsPerHour: hourlyRows.map((r) => ({
      hour: Number(r.hour),
      count: Number(r.count),
    })),
    averageRotation: Math.round(mean * 100) / 100,
    overRotatedSongs: overRotated,
  });
}

/**
 * GET /station/discovery-score
 *
 * What percentage of this station's recent airplay consists of
 * "new songs" (ISRCs first seen across ALL stations in the last 30 days).
 */
export async function getDiscoveryScore(
  request: FastifyRequest<{ Querystring: PeriodQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const ownStationIds = getOwnStationIds(request);
  if (ownStationIds.length === 0) {
    return reply.send({
      score: 0,
      newSongsCount: 0,
      totalSongsCount: 0,
      newSongsPlays: 0,
      totalPlays: 0,
    });
  }

  const { start, end } = getDateRange(request.query);

  // Step 1: Find ISRCs first seen across ALL stations in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const newIsrcRows = await prisma.$queryRaw<Array<{ isrc: string }>>`
    SELECT isrc
    FROM airplay_events
    WHERE isrc IS NOT NULL
    GROUP BY isrc
    HAVING MIN(started_at) >= ${thirtyDaysAgo}
  `;

  const newIsrcs = new Set(newIsrcRows.map((r) => r.isrc));

  // Step 2: Get play counts on own station(s) within the period
  const playRows = await prisma.$queryRaw<
    Array<{ isrc: string | null; play_count: bigint | number }>
  >`
    SELECT
      isrc,
      COUNT(*)::int AS play_count
    FROM airplay_events
    WHERE station_id IN (${Prisma.join(ownStationIds)})
      AND started_at >= ${start}
      AND started_at <= ${end}
    GROUP BY isrc
  `;

  let totalPlays = 0;
  let newSongsPlays = 0;
  let totalSongsCount = 0;
  let newSongsCount = 0;

  for (const row of playRows) {
    const count = Number(row.play_count);
    totalPlays += count;
    totalSongsCount++;

    if (row.isrc && newIsrcs.has(row.isrc)) {
      newSongsPlays += count;
      newSongsCount++;
    }
  }

  const score =
    totalPlays > 0
      ? Math.round((newSongsPlays / totalPlays) * 10000) / 100
      : 0;

  return reply.send({
    score,
    newSongsCount,
    totalSongsCount,
    newSongsPlays,
    totalPlays,
  });
}
