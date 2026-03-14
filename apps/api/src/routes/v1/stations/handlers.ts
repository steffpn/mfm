import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../../lib/prisma.js";
import {
  CHANNELS,
  publishStationEvent,
  type StationEvent,
} from "../../../lib/pubsub.js";
import type {
  StationCreateBody,
  StationBulkCreateBody,
  StationUpdateBody,
  StationParams,
} from "./schema.js";

/**
 * POST /stations - Create a single station.
 * Sets status to ACTIVE and publishes station:added event.
 */
export async function createStation(
  request: FastifyRequest<{ Body: StationCreateBody }>,
  reply: FastifyReply,
): Promise<void> {
  const station = await prisma.station.create({
    data: {
      name: request.body.name,
      streamUrl: request.body.streamUrl,
      stationType: request.body.stationType,
      country: request.body.country ?? "RO",
      status: "ACTIVE",
    },
  });

  const event: StationEvent = {
    stationId: station.id,
    streamUrl: station.streamUrl,
    timestamp: new Date().toISOString(),
  };
  await publishStationEvent(CHANNELS.STATION_ADDED, event);

  return reply.status(201).send(station);
}

/**
 * POST /stations/bulk - Create multiple stations in a transaction.
 * Publishes station:added for each created station.
 */
export async function createStationsBulk(
  request: FastifyRequest<{ Body: StationBulkCreateBody }>,
  reply: FastifyReply,
): Promise<void> {
  const stations = await prisma.$transaction(
    request.body.map((s) =>
      prisma.station.create({
        data: {
          name: s.name,
          streamUrl: s.streamUrl,
          stationType: s.stationType,
          country: s.country ?? "RO",
          status: "ACTIVE",
        },
      }),
    ),
  );

  // Publish events for each created station
  for (const station of stations) {
    const event: StationEvent = {
      stationId: station.id,
      streamUrl: station.streamUrl,
      timestamp: new Date().toISOString(),
    };
    await publishStationEvent(CHANNELS.STATION_ADDED, event);
  }

  return reply.status(201).send(stations);
}

/**
 * GET /stations - List all stations with health fields.
 */
export async function listStations(): Promise<unknown> {
  return prisma.station.findMany({
    select: {
      id: true,
      name: true,
      streamUrl: true,
      stationType: true,
      country: true,
      status: true,
      lastHeartbeat: true,
      restartCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * GET /stations/:id - Get a single station by ID.
 */
export async function getStation(
  request: FastifyRequest<{ Params: StationParams }>,
  reply: FastifyReply,
): Promise<void> {
  const station = await prisma.station.findUnique({
    where: { id: request.params.id },
  });

  if (!station) {
    return reply.status(404).send({ error: "Station not found" });
  }

  return reply.send(station);
}

/**
 * PATCH /stations/:id - Update a station.
 * Publishes station:updated event with new streamUrl.
 */
export async function updateStation(
  request: FastifyRequest<{ Params: StationParams; Body: StationUpdateBody }>,
  reply: FastifyReply,
): Promise<void> {
  // Check existence first to return 404 properly
  const existing = await prisma.station.findUnique({
    where: { id: request.params.id },
  });

  if (!existing) {
    return reply.status(404).send({ error: "Station not found" });
  }

  const station = await prisma.station.update({
    where: { id: request.params.id },
    data: request.body,
  });

  const event: StationEvent = {
    stationId: station.id,
    streamUrl: station.streamUrl,
    timestamp: new Date().toISOString(),
  };
  await publishStationEvent(CHANNELS.STATION_UPDATED, event);

  return reply.send(station);
}

/**
 * DELETE /stations/:id - Soft delete by setting status to INACTIVE.
 * Publishes station:removed event.
 */
export async function deleteStation(
  request: FastifyRequest<{ Params: StationParams }>,
  reply: FastifyReply,
): Promise<void> {
  const existing = await prisma.station.findUnique({
    where: { id: request.params.id },
  });

  if (!existing) {
    return reply.status(404).send({ error: "Station not found" });
  }

  const station = await prisma.station.update({
    where: { id: request.params.id },
    data: { status: "INACTIVE" },
  });

  const event: StationEvent = {
    stationId: station.id,
    timestamp: new Date().toISOString(),
  };
  await publishStationEvent(CHANNELS.STATION_REMOVED, event);

  return reply.send(station);
}
