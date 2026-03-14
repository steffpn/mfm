/**
 * Redis pub/sub channel definitions, event types, and publish helpers.
 *
 * Used by station CRUD handlers to notify the supervisor service of
 * station lifecycle changes (added, removed, updated).
 */

import { redis } from "./redis.js";

export const CHANNELS = {
  STATION_ADDED: "station:added",
  STATION_REMOVED: "station:removed",
  STATION_UPDATED: "station:updated",
} as const;

export type Channel = (typeof CHANNELS)[keyof typeof CHANNELS];

export interface StationEvent {
  stationId: number;
  streamUrl?: string;
  timestamp: string;
}

/**
 * Publish a station lifecycle event to a Redis pub/sub channel.
 */
export async function publishStationEvent(
  channel: Channel,
  event: StationEvent,
): Promise<void> {
  await redis.publish(channel, JSON.stringify(event));
}
