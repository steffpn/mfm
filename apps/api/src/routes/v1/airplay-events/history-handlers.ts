import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../../lib/prisma.js";
import type { SongHistoryQuery } from "./history-schema.js";

/**
 * GET /airplay-events/history - Song detection timeline.
 *
 * Shows ALL detection moments for a specific song across all stations.
 * Search by ISRC (includes prefix matching for different versions) or title+artist.
 * Filter by station, date range.
 */
export async function getSongHistory(
  request: FastifyRequest<{ Querystring: SongHistoryQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const {
    isrc,
    songTitle,
    artistName,
    stationId,
    startDate,
    endDate,
    cursor,
    limit: rawLimit,
  } = request.query;
  const limit = rawLimit || 50;

  if (!isrc && !songTitle) {
    return reply
      .status(400)
      .send({ error: "Provide isrc or songTitle to search" });
  }

  const where: Record<string, unknown> = {};

  // ISRC search: include prefix matching (first 9 chars) for different versions
  if (isrc) {
    if (isrc.length >= 9) {
      where.isrc = { startsWith: isrc.substring(0, 9) };
    } else {
      where.isrc = isrc;
    }
  } else if (songTitle) {
    // Title + optional artist search
    where.songTitle = { contains: songTitle, mode: "insensitive" };
    if (artistName) {
      where.artistName = { contains: artistName, mode: "insensitive" };
    }
  }

  // Station filter
  if (stationId) {
    where.stationId = stationId;
  }

  // Date range
  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    where.startedAt = dateFilter;
  }

  // Cursor pagination
  if (cursor) {
    where.id = { lt: cursor };
  }

  // Scope filtering for STATION role
  const { currentUser } = request;
  if (currentUser.role === "STATION") {
    const stationScopes = currentUser.scopes
      .filter((s) => s.entityType === "STATION")
      .map((s) => s.entityId);
    where.stationId = stationId
      ? { in: stationScopes.includes(stationId) ? [stationId] : [] }
      : { in: stationScopes };
  }

  const events = await prisma.airplayEvent.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: limit + 1,
    include: { station: { select: { name: true } } },
  });

  const hasMore = events.length > limit;
  const data = hasMore ? events.slice(0, limit) : events;
  const nextCursor =
    hasMore && data.length > 0 ? data[data.length - 1].id : null;

  // Aggregate stats
  const totalPlays = data.reduce((sum, e) => sum + e.playCount, 0);
  const stations = [...new Set(data.map((e) => e.station.name))];

  return reply.send({
    data,
    nextCursor,
    stats: {
      eventsInPage: data.length,
      totalPlays,
      stations,
    },
  });
}
