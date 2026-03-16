/**
 * Server-side event filtering for the live feed SSE route.
 *
 * Determines whether a detection event should be delivered to a specific
 * user based on their role and scopes.
 */

import type { LiveDetectionEvent } from "./pubsub.js";
import type { CurrentUser } from "../middleware/authenticate.js";

/**
 * Check if a live detection event should be delivered to the given user.
 *
 * Filtering rules:
 * - ADMIN: receives all events
 * - STATION: receives events from stations in their scopes
 * - ARTIST/LABEL: receives all events if they have any scope entry
 */
export function shouldDeliverToUser(
  event: LiveDetectionEvent,
  user: CurrentUser,
): boolean {
  // ADMIN sees everything
  if (user.role === "ADMIN") return true;

  // STATION sees only events from stations in their scopes
  if (user.role === "STATION") {
    const stationIds = user.scopes
      .filter((s) => s.entityType === "STATION")
      .map((s) => s.entityId);
    return stationIds.includes(event.stationId);
  }

  // ARTIST / LABEL: allow all events if they have any scope entry
  // (deferred until entity models added -- same pattern as airplay-events handler)
  return user.scopes.length > 0;
}
