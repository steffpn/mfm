import type { FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "../../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import type { DashboardSummaryQuery, TopStationsQuery } from "./schema.js";

/**
 * Map period string to interval days.
 */
function periodToDays(period: string): number {
  switch (period) {
    case "week":
      return 7;
    case "month":
      return 30;
    default:
      return 1;
  }
}

/**
 * Extract station IDs from STATION role user scopes.
 * Returns null for roles that see all data (ADMIN, ARTIST, LABEL).
 */
function getScopedStationIds(
  request: FastifyRequest,
): number[] | null {
  const { currentUser } = request;

  if (currentUser.role === "ADMIN") return null;

  if (currentUser.role === "STATION") {
    return currentUser.scopes
      .filter((s) => s.entityType === "STATION")
      .map((s) => s.entityId);
  }

  // ARTIST/LABEL: see all data (scope filtering deferred per Phase 5 decision)
  return null;
}

/**
 * GET /dashboard/summary
 *
 * Returns aggregated play counts from daily_station_plays continuous aggregate.
 * Supports period=day|week|month (default: day).
 * STATION role users see only data for their scoped station IDs.
 */
export async function getDashboardSummary(
  request: FastifyRequest<{ Querystring: DashboardSummaryQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const period = request.query.period || "day";
  const days = periodToDays(period);
  const stationIds = getScopedStationIds(request);

  let rows: Array<{
    bucket: Date;
    play_count: bigint | number;
    unique_songs: bigint | number;
    unique_artists: bigint | number;
  }>;

  if (stationIds !== null) {
    if (stationIds.length === 0) {
      return reply.send({ buckets: [], totals: { playCount: 0, uniqueSongs: 0, uniqueArtists: 0 } });
    }
    rows = await prisma.$queryRaw`
      SELECT bucket, play_count, unique_songs, unique_artists
      FROM daily_station_plays
      WHERE bucket >= NOW() - ${days + " days"}::interval
        AND station_id IN (${Prisma.join(stationIds)})
      ORDER BY bucket ASC
    `;
  } else {
    rows = await prisma.$queryRaw`
      SELECT
        bucket,
        SUM(play_count)::int AS play_count,
        SUM(unique_songs)::int AS unique_songs,
        SUM(unique_artists)::int AS unique_artists
      FROM daily_station_plays
      WHERE bucket >= NOW() - ${days + " days"}::interval
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
  }

  const buckets = rows.map((r) => ({
    bucket: r.bucket instanceof Date ? r.bucket.toISOString() : String(r.bucket),
    playCount: Number(r.play_count),
    uniqueSongs: Number(r.unique_songs),
    uniqueArtists: Number(r.unique_artists),
  }));

  const totals = {
    playCount: buckets.reduce((sum, b) => sum + b.playCount, 0),
    uniqueSongs: buckets.reduce((sum, b) => sum + b.uniqueSongs, 0),
    uniqueArtists: buckets.reduce((sum, b) => sum + b.uniqueArtists, 0),
  };

  return reply.send({ buckets, totals });
}

/**
 * GET /dashboard/top-stations
 *
 * Returns ranked station list with play counts from daily_station_plays
 * joined with stations for station name.
 * Supports period=day|week|month (default: day) and limit (default: 10, max: 50).
 * STATION role users see only their scoped stations.
 */
export async function getTopStations(
  request: FastifyRequest<{ Querystring: TopStationsQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const period = request.query.period || "day";
  const limit = request.query.limit || 10;
  const days = periodToDays(period);
  const stationIds = getScopedStationIds(request);

  let rows: Array<{
    station_id: number;
    station_name: string;
    play_count: bigint | number;
  }>;

  if (stationIds !== null) {
    if (stationIds.length === 0) {
      return reply.send({ stations: [] });
    }
    rows = await prisma.$queryRaw`
      SELECT
        d.station_id,
        s.name AS station_name,
        SUM(d.play_count)::int AS play_count
      FROM daily_station_plays d
      JOIN stations s ON s.id = d.station_id
      WHERE d.bucket >= NOW() - ${days + " days"}::interval
        AND d.station_id IN (${Prisma.join(stationIds)})
      GROUP BY d.station_id, s.name
      ORDER BY play_count DESC
      LIMIT ${limit}
    `;
  } else {
    rows = await prisma.$queryRaw`
      SELECT
        d.station_id,
        s.name AS station_name,
        SUM(d.play_count)::int AS play_count
      FROM daily_station_plays d
      JOIN stations s ON s.id = d.station_id
      WHERE d.bucket >= NOW() - ${days + " days"}::interval
      GROUP BY d.station_id, s.name
      ORDER BY play_count DESC
      LIMIT ${limit}
    `;
  }

  const stations = rows.map((r) => ({
    stationId: Number(r.station_id),
    stationName: r.station_name,
    playCount: Number(r.play_count),
  }));

  return reply.send({ stations });
}
