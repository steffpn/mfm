import { describe, it, expect, afterAll, beforeAll, beforeEach } from "vitest";
import { server } from "../../src/index.js";
import { prisma } from "../../src/lib/prisma.js";
import { createRedisConnection } from "../../src/lib/redis.js";
import { CHANNELS, type StationEvent } from "../../src/lib/pubsub.js";
import {
  createTestAdmin,
  getAuthTokens,
  createTestUserWithTokens,
} from "../helpers/auth.js";

describe("Station CRUD Routes", () => {
  let subscriber: ReturnType<typeof createRedisConnection>;
  let adminToken: string;

  beforeAll(async () => {
    await server.ready();
    subscriber = createRedisConnection();

    // Create admin and get auth token
    await createTestAdmin(server);
    const tokens = await getAuthTokens(server, "admin@test.com", "AdminPass123!");
    adminToken = tokens.accessToken;
  });

  beforeEach(async () => {
    // Clean up test stations before each test
    await prisma.station.deleteMany({});
    subscriber.removeAllListeners("message");
  });

  afterAll(async () => {
    await prisma.station.deleteMany({});
    subscriber.disconnect();
    await prisma.refreshToken.deleteMany({});
    await prisma.userScope.deleteMany({});
    await prisma.user.deleteMany({});
    await server.close();
  });

  // --- Auth enforcement ---

  describe("Auth enforcement", () => {
    it("returns 401 for unauthenticated request", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/stations",
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 403 for non-admin authenticated request", async () => {
      const { accessToken } = await createTestUserWithTokens(
        server,
        "ARTIST",
        "artist-stations@test.com"
      );

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/stations",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  // --- POST /api/v1/stations ---

  describe("POST /api/v1/stations", () => {
    it("creates a station with valid body and returns 201", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/stations",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: "Radio Test",
          streamUrl: "http://example.com/stream",
          stationType: "radio",
          acrcloudStreamId: "test-stream-1",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.name).toBe("Radio Test");
      expect(body.streamUrl).toBe("http://example.com/stream");
      expect(body.stationType).toBe("radio");
      expect(body.acrcloudStreamId).toBe("test-stream-1");
      expect(body.status).toBe("ACTIVE");
      expect(body.country).toBe("RO");
      expect(body.id).toBeDefined();
    });

    it("returns 400 when required fields are missing", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/stations",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: "Radio Test",
          // missing streamUrl, stationType, and acrcloudStreamId
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 when acrcloudStreamId is missing", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/stations",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: "Radio Test",
          streamUrl: "http://example.com/stream",
          stationType: "radio",
          // missing acrcloudStreamId
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 when name is empty string", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/stations",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: "",
          streamUrl: "http://example.com/stream",
          stationType: "radio",
          acrcloudStreamId: "test-stream-empty",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("publishes station:added event to Redis", async () => {
      const received = new Promise<StationEvent>((resolve) => {
        subscriber.on("message", (_channel: string, message: string) => {
          resolve(JSON.parse(message));
        });
      });

      await subscriber.subscribe(CHANNELS.STATION_ADDED);
      await new Promise((r) => setTimeout(r, 100));

      await server.inject({
        method: "POST",
        url: "/api/v1/stations",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: "PubSub Test Station",
          streamUrl: "http://example.com/stream",
          stationType: "radio",
          acrcloudStreamId: "test-stream-pubsub",
        },
      });

      const event = await received;
      expect(event.stationId).toBeDefined();
      expect(event.streamUrl).toBe("http://example.com/stream");
      expect(event.timestamp).toBeDefined();

      await subscriber.unsubscribe(CHANNELS.STATION_ADDED);
    });

    it("accepts optional country field", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/stations",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: "Radio France",
          streamUrl: "http://example.fr/stream",
          stationType: "radio",
          acrcloudStreamId: "test-stream-fr",
          country: "FR",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.country).toBe("FR");
    });
  });

  // --- POST /api/v1/stations/bulk ---

  describe("POST /api/v1/stations/bulk", () => {
    it("creates multiple stations and returns 201", async () => {
      const stations = [
        {
          name: "Station A",
          streamUrl: "http://example.com/a",
          stationType: "radio",
          acrcloudStreamId: "test-stream-a",
        },
        {
          name: "Station B",
          streamUrl: "http://example.com/b",
          stationType: "tv",
          acrcloudStreamId: "test-stream-b",
        },
      ];

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/stations/bulk",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: stations,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(2);
      expect(body[0].name).toBe("Station A");
      expect(body[0].status).toBe("ACTIVE");
      expect(body[0].acrcloudStreamId).toBe("test-stream-a");
      expect(body[1].name).toBe("Station B");
      expect(body[1].stationType).toBe("tv");
      expect(body[1].acrcloudStreamId).toBe("test-stream-b");
    });

    it("publishes station:added for each created station", async () => {
      const events: StationEvent[] = [];
      const received = new Promise<void>((resolve) => {
        subscriber.on("message", (_channel: string, message: string) => {
          events.push(JSON.parse(message));
          if (events.length === 2) resolve();
        });
      });

      await subscriber.subscribe(CHANNELS.STATION_ADDED);
      await new Promise((r) => setTimeout(r, 100));

      await server.inject({
        method: "POST",
        url: "/api/v1/stations/bulk",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: [
          {
            name: "Bulk A",
            streamUrl: "http://example.com/a",
            stationType: "radio",
            acrcloudStreamId: "test-bulk-a",
          },
          {
            name: "Bulk B",
            streamUrl: "http://example.com/b",
            stationType: "radio",
            acrcloudStreamId: "test-bulk-b",
          },
        ],
      });

      await received;
      expect(events).toHaveLength(2);
      expect(events[0].stationId).toBeDefined();
      expect(events[1].stationId).toBeDefined();

      await subscriber.unsubscribe(CHANNELS.STATION_ADDED);
    });

    it("returns 400 for empty array", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/stations/bulk",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: [],
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // --- GET /api/v1/stations ---

  describe("GET /api/v1/stations", () => {
    it("returns array of all stations with health fields and acrcloudStreamId", async () => {
      // Create test stations
      await prisma.station.createMany({
        data: [
          {
            name: "Radio 1",
            streamUrl: "http://example.com/1",
            stationType: "radio",
            acrcloudStreamId: "test-list-1",
            status: "ACTIVE",
          },
          {
            name: "TV 1",
            streamUrl: "http://example.com/2",
            stationType: "tv",
            acrcloudStreamId: "test-list-2",
            status: "INACTIVE",
          },
        ],
      });

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/stations",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(2);

      // Check health fields and acrcloudStreamId are present
      const station = body[0];
      expect(station.id).toBeDefined();
      expect(station.name).toBeDefined();
      expect(station.streamUrl).toBeDefined();
      expect(station.stationType).toBeDefined();
      expect(station.acrcloudStreamId).toBeDefined();
      expect(station.status).toBeDefined();
      expect("lastHeartbeat" in station).toBe(true);
      expect("restartCount" in station).toBe(true);
    });
  });

  // --- GET /api/v1/stations/:id ---

  describe("GET /api/v1/stations/:id", () => {
    it("returns single station", async () => {
      const station = await prisma.station.create({
        data: {
          name: "Single Station",
          streamUrl: "http://example.com/single",
          stationType: "radio",
          acrcloudStreamId: "test-single",
          status: "ACTIVE",
        },
      });

      const response = await server.inject({
        method: "GET",
        url: `/api/v1/stations/${station.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.name).toBe("Single Station");
      expect(body.id).toBe(station.id);
    });

    it("returns 404 for non-existent station", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/stations/99999",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // --- PATCH /api/v1/stations/:id ---

  describe("PATCH /api/v1/stations/:id", () => {
    it("updates station and returns updated data", async () => {
      const station = await prisma.station.create({
        data: {
          name: "Update Test",
          streamUrl: "http://example.com/old",
          stationType: "radio",
          acrcloudStreamId: "test-update",
          status: "ACTIVE",
        },
      });

      const response = await server.inject({
        method: "PATCH",
        url: `/api/v1/stations/${station.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          streamUrl: "http://example.com/new",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.streamUrl).toBe("http://example.com/new");
    });

    it("publishes station:updated event", async () => {
      const station = await prisma.station.create({
        data: {
          name: "PubSub Update",
          streamUrl: "http://example.com/pubsub",
          stationType: "radio",
          acrcloudStreamId: "test-pubsub-update",
          status: "ACTIVE",
        },
      });

      const received = new Promise<StationEvent>((resolve) => {
        subscriber.on("message", (_channel: string, message: string) => {
          resolve(JSON.parse(message));
        });
      });

      await subscriber.subscribe(CHANNELS.STATION_UPDATED);
      await new Promise((r) => setTimeout(r, 100));

      await server.inject({
        method: "PATCH",
        url: `/api/v1/stations/${station.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          streamUrl: "http://example.com/updated",
        },
      });

      const event = await received;
      expect(event.stationId).toBe(station.id);
      expect(event.streamUrl).toBe("http://example.com/updated");
      expect(event.timestamp).toBeDefined();

      await subscriber.unsubscribe(CHANNELS.STATION_UPDATED);
    });

    it("returns 404 for non-existent station", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: "/api/v1/stations/99999",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: "Ghost",
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // --- DELETE /api/v1/stations/:id ---

  describe("DELETE /api/v1/stations/:id", () => {
    it("soft-deletes station by setting status to INACTIVE", async () => {
      const station = await prisma.station.create({
        data: {
          name: "Delete Test",
          streamUrl: "http://example.com/delete",
          stationType: "radio",
          acrcloudStreamId: "test-delete",
          status: "ACTIVE",
        },
      });

      const response = await server.inject({
        method: "DELETE",
        url: `/api/v1/stations/${station.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe("INACTIVE");

      // Verify in DB
      const dbStation = await prisma.station.findUnique({
        where: { id: station.id },
      });
      expect(dbStation).not.toBeNull();
      expect(dbStation!.status).toBe("INACTIVE");
    });

    it("publishes station:removed event", async () => {
      const station = await prisma.station.create({
        data: {
          name: "PubSub Delete",
          streamUrl: "http://example.com/pubsub-del",
          stationType: "radio",
          acrcloudStreamId: "test-pubsub-delete",
          status: "ACTIVE",
        },
      });

      const received = new Promise<StationEvent>((resolve) => {
        subscriber.on("message", (_channel: string, message: string) => {
          resolve(JSON.parse(message));
        });
      });

      await subscriber.subscribe(CHANNELS.STATION_REMOVED);
      await new Promise((r) => setTimeout(r, 100));

      await server.inject({
        method: "DELETE",
        url: `/api/v1/stations/${station.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const event = await received;
      expect(event.stationId).toBe(station.id);
      expect(event.timestamp).toBeDefined();

      await subscriber.unsubscribe(CHANNELS.STATION_REMOVED);
    });

    it("returns 404 for non-existent station", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: "/api/v1/stations/99999",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
