import { prisma } from "../../../lib/prisma.js";
import type { CurrentUser } from "../../../middleware/authenticate.js";

interface FilterParams {
  q?: string;
  startDate?: string;
  endDate?: string;
  stationId?: number;
}

interface QueryOptions {
  maxRows?: number;
}

interface QueryResult {
  events: Array<Record<string, unknown>>;
  exceeded: boolean;
}

/**
 * Shared filtered query builder for airplay events.
 *
 * Extracted from listEvents handler -- applies search, date range,
 * station filter, and role-based scope filtering.
 *
 * Uses maxRows + 1 to detect overflow without fetching all data.
 */
export async function queryFilteredEvents(
  filters: FilterParams,
  currentUser: CurrentUser,
  options?: QueryOptions,
): Promise<QueryResult> {
  const { q, startDate, endDate, stationId } = filters;

  // Build where clause
  const where: Record<string, unknown> = {};

  // Search: OR across songTitle, artistName (contains), isrc (equals)
  if (q) {
    where.OR = [
      { songTitle: { contains: q, mode: "insensitive" } },
      { artistName: { contains: q, mode: "insensitive" } },
      { isrc: { equals: q, mode: "insensitive" } },
    ];
  }

  // Date range filter
  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    where.startedAt = dateFilter;
  }

  // Station filter
  if (stationId) {
    where.stationId = stationId;
  }

  // Scope-based filtering
  if (currentUser.role === "STATION") {
    const stationScopes = currentUser.scopes
      .filter((s) => s.entityType === "STATION")
      .map((s) => s.entityId);

    // Override any explicit stationId with scope constraint
    where.stationId = { in: stationScopes };
  }
  // ADMIN, ARTIST, LABEL: no additional scope filter

  const maxRows = options?.maxRows;
  const take = maxRows ? maxRows + 1 : undefined;

  const events = await prisma.airplayEvent.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take,
    include: { station: { select: { name: true } } },
  });

  const exceeded = maxRows ? events.length > maxRows : false;
  const data = exceeded && maxRows ? events.slice(0, maxRows) : events;

  return { events: data, exceeded };
}
