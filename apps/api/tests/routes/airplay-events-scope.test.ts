import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { server } from "../../src/index.js";
import { prisma } from "../../src/lib/prisma.js";
import {
  createTestAdmin,
  getAuthTokens,
  createTestUserWithTokens,
} from "../helpers/auth.js";

describe("Airplay Events Scope Filtering", () => {
  let adminToken: string;
  let stationUserToken: string;
  let station1Id: number;
  let station2Id: number;
  let event1Id: number;
  let event2Id: number;

  beforeAll(async () => {
    await server.ready();

    // Create admin
    await createTestAdmin(server);
    const adminTokens = await getAuthTokens(
      server,
      "admin@test.com",
      "AdminPass123!"
    );
    adminToken = adminTokens.accessToken;

    // Create two stations
    const station1 = await prisma.station.create({
      data: {
        name: "Scoped Station 1",
        streamUrl: "http://example.com/s1",
        stationType: "radio",
        acrcloudStreamId: "scope-test-s1",
        status: "ACTIVE",
      },
    });
    station1Id = station1.id;

    const station2 = await prisma.station.create({
      data: {
        name: "Scoped Station 2",
        streamUrl: "http://example.com/s2",
        stationType: "radio",
        acrcloudStreamId: "scope-test-s2",
        status: "ACTIVE",
      },
    });
    station2Id = station2.id;

    // Create airplay events for each station (with snippetUrl so they return URLs)
    const ev1 = await prisma.airplayEvent.create({
      data: {
        stationId: station1Id,
        startedAt: new Date(),
        endedAt: new Date(),
        songTitle: "Song A",
        artistName: "Artist A",
        snippetUrl: "snippets/test-scope-1.m4a",
      },
    });
    event1Id = ev1.id;

    const ev2 = await prisma.airplayEvent.create({
      data: {
        stationId: station2Id,
        startedAt: new Date(),
        endedAt: new Date(),
        songTitle: "Song B",
        artistName: "Artist B",
        snippetUrl: "snippets/test-scope-2.m4a",
      },
    });
    event2Id = ev2.id;

    // Create a STATION-scoped user with access to station1 only
    const { user: stationUser, accessToken } = await createTestUserWithTokens(
      server,
      "STATION",
      "station-scope@test.com"
    );
    stationUserToken = accessToken;

    // Add scope for station1 only
    await prisma.userScope.create({
      data: {
        userId: stationUser.id,
        entityType: "STATION",
        entityId: station1Id,
      },
    });
  });

  afterAll(async () => {
    await prisma.airplayEvent.deleteMany({});
    await prisma.station.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.userScope.deleteMany({});
    await prisma.user.deleteMany({});
    await server.close();
  });

  // --- Auth enforcement ---

  describe("Auth enforcement", () => {
    it("returns 401 for unauthenticated snippet request", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/v1/airplay-events/${event1Id}/snippet`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // --- Admin access ---

  describe("Admin access", () => {
    it("admin can access snippet for any event (station 1)", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/v1/airplay-events/${event1Id}/snippet`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      // 200 with URL or 500 if R2 not configured -- but NOT 404
      expect([200, 500]).toContain(response.statusCode);
    });

    it("admin can access snippet for any event (station 2)", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/v1/airplay-events/${event2Id}/snippet`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([200, 500]).toContain(response.statusCode);
    });
  });

  // --- Scope-based filtering ---

  describe("Scope-based filtering for STATION user", () => {
    it("STATION user can access event within their scoped station", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/v1/airplay-events/${event1Id}/snippet`,
        headers: { authorization: `Bearer ${stationUserToken}` },
      });

      // 200 with URL or 500 if R2 not configured -- but NOT 404
      expect([200, 500]).toContain(response.statusCode);
    });

    it("STATION user gets 404 for event outside their scoped station", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/v1/airplay-events/${event2Id}/snippet`,
        headers: { authorization: `Bearer ${stationUserToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
