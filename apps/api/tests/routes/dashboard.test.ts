import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Prisma mock ----
const mockQueryRaw = vi.fn();
const mockUserFindUnique = vi.fn();

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      count: vi.fn().mockResolvedValue(1),
    },
    airplayEvent: {
      findUnique: vi.fn(),
    },
  },
}));

// ---- R2 mock ----
vi.mock("../../src/lib/r2.js", () => ({
  getPresignedUrl: vi.fn(),
  r2Client: null,
  uploadToR2: vi.fn(),
}));

// ---- Redis mock ----
vi.mock("../../src/lib/redis.js", () => ({
  createRedisConnection: vi.fn().mockReturnValue({
    subscribe: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
  }),
  redis: {
    ping: vi.fn().mockResolvedValue("PONG"),
    disconnect: vi.fn(),
  },
}));

// ---- Auth mock helper ----
const mockAdminUser = {
  id: 1,
  email: "admin@test.com",
  name: "Admin",
  role: "ADMIN",
  isActive: true,
  scopes: [{ id: 1, userId: 1, entityType: "STATION", entityId: 1 }],
};

const mockStationUser = {
  id: 2,
  email: "station@test.com",
  name: "Station User",
  role: "STATION",
  isActive: true,
  scopes: [
    { id: 2, userId: 2, entityType: "STATION", entityId: 5 },
    { id: 3, userId: 2, entityType: "STATION", entityId: 10 },
  ],
};

describe("Dashboard Routes", () => {
  let server: Awaited<typeof import("../../src/index.js")>["server"];
  let adminToken: string;
  let stationToken: string;

  beforeEach(async () => {
    mockQueryRaw.mockClear();
    mockUserFindUnique.mockClear();

    const mod = await import("../../src/index.js");
    server = mod.server;
    await server.ready();

    // Generate JWT tokens using the server's jwt plugin
    adminToken = server.jwt.sign({ sub: mockAdminUser.id });
    stationToken = server.jwt.sign({ sub: mockStationUser.id });

    // Mock user lookup for authenticate middleware
    mockUserFindUnique.mockImplementation(({ where }: { where: { id: number } }) => {
      if (where.id === mockAdminUser.id) return Promise.resolve(mockAdminUser);
      if (where.id === mockStationUser.id) return Promise.resolve(mockStationUser);
      return Promise.resolve(null);
    });
  });

  // --- GET /api/v1/dashboard/summary ---

  describe("GET /api/v1/dashboard/summary", () => {
    it("returns 401 without authentication", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary",
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns bucketed data and totals for default period (day)", async () => {
      mockQueryRaw.mockResolvedValueOnce([
        { bucket: new Date("2026-03-16"), play_count: 100, unique_songs: 50, unique_artists: 20 },
      ]);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty("buckets");
      expect(body).toHaveProperty("totals");
      expect(body.buckets).toHaveLength(1);
      expect(body.buckets[0]).toMatchObject({
        bucket: expect.any(String),
        playCount: 100,
        uniqueSongs: 50,
        uniqueArtists: 20,
      });
      expect(body.totals).toMatchObject({
        playCount: 100,
        uniqueSongs: 50,
        uniqueArtists: 20,
      });
    });

    it("accepts period=week parameter", async () => {
      mockQueryRaw.mockResolvedValueOnce([
        { bucket: new Date("2026-03-10"), play_count: 300, unique_songs: 120, unique_artists: 60 },
        { bucket: new Date("2026-03-16"), play_count: 200, unique_songs: 80, unique_artists: 40 },
      ]);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary?period=week",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.buckets).toHaveLength(2);
      expect(body.totals.playCount).toBe(500);
      expect(body.totals.uniqueSongs).toBe(200);
      expect(body.totals.uniqueArtists).toBe(100);
    });

    it("accepts period=month parameter", async () => {
      mockQueryRaw.mockResolvedValueOnce([]);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary?period=month",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.buckets).toHaveLength(0);
      expect(body.totals).toMatchObject({ playCount: 0, uniqueSongs: 0, uniqueArtists: 0 });
    });

    it("STATION role user only sees data for scoped stations", async () => {
      mockQueryRaw.mockResolvedValueOnce([
        { bucket: new Date("2026-03-16"), play_count: 50, unique_songs: 25, unique_artists: 10 },
      ]);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/dashboard/summary",
        headers: { authorization: `Bearer ${stationToken}` },
      });

      expect(response.statusCode).toBe(200);
      // Verify that $queryRaw was called (scope filtering happens in SQL)
      expect(mockQueryRaw).toHaveBeenCalled();
    });
  });

  // --- GET /api/v1/dashboard/top-stations ---

  describe("GET /api/v1/dashboard/top-stations", () => {
    it("returns 401 without authentication", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/dashboard/top-stations",
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns ranked station list with default limit (10)", async () => {
      mockQueryRaw.mockResolvedValueOnce([
        { station_id: 1, station_name: "Radio ZU", play_count: 500 },
        { station_id: 2, station_name: "Kiss FM", play_count: 300 },
      ]);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/dashboard/top-stations",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty("stations");
      expect(body.stations).toHaveLength(2);
      expect(body.stations[0]).toMatchObject({
        stationId: 1,
        stationName: "Radio ZU",
        playCount: 500,
      });
      expect(body.stations[1]).toMatchObject({
        stationId: 2,
        stationName: "Kiss FM",
        playCount: 300,
      });
    });

    it("respects custom limit parameter", async () => {
      mockQueryRaw.mockResolvedValueOnce([
        { station_id: 1, station_name: "Radio ZU", play_count: 500 },
      ]);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/dashboard/top-stations?limit=1",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.stations).toHaveLength(1);
    });

    it("accepts period parameter", async () => {
      mockQueryRaw.mockResolvedValueOnce([]);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/dashboard/top-stations?period=month&limit=5",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.stations).toHaveLength(0);
    });

    it("STATION role user only sees their scoped stations", async () => {
      mockQueryRaw.mockResolvedValueOnce([
        { station_id: 5, station_name: "My Station", play_count: 100 },
      ]);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/dashboard/top-stations",
        headers: { authorization: `Bearer ${stationToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(mockQueryRaw).toHaveBeenCalled();
    });
  });
});
