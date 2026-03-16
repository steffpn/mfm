/**
 * Redis pub/sub channel definitions, event types, and publish helpers.
 *
 * Used by station CRUD handlers to notify the supervisor service of
 * station lifecycle changes (added, removed, updated).
 * Also used by the detection worker to broadcast new detection events
 * for the live feed SSE endpoint.
 */

import { redis } from "./redis.js";

export const CHANNELS = {
  STATION_ADDED: "station:added",
  STATION_REMOVED: "station:removed",
  STATION_UPDATED: "station:updated",
  DETECTION_NEW: "detection:new",
} as const;

export type Channel = (typeof CHANNELS)[keyof typeof CHANNELS];

export interface StationEvent {
  stationId: number;
  streamUrl?: string;
  timestamp: string;
}

/**
 * Event published to Redis pub/sub when a new AirplayEvent is created.
 * Used by the SSE live-feed route to stream detection events to clients.
 */
export interface LiveDetectionEvent {
  id: number;
  stationId: number;
  songTitle: string;
  artistName: string;
  isrc: string | null;
  snippetUrl: string | null;
  stationName: string;
  startedAt: string;    // ISO 8601
  publishedAt: string;  // ISO 8601
}

/** Redis sorted set key for recent events (backfill replay) */
export const BACKFILL_KEY = "live-feed:recent";

/** Maximum number of events to keep in the backfill sorted set */
export const BACKFILL_MAX = 200;

/**
 * Publish a station lifecycle event to a Redis pub/sub channel.
 */
export async function publishStationEvent(
  channel: Channel,
  event: StationEvent,
): Promise<void> {
  await redis.publish(channel, JSON.stringify(event));
}
