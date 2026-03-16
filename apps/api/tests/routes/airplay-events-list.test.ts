import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Prisma mock ----
const mockAirplayEventFindMany = vi.fn();
const mockUserFindUnique = vi.fn();

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    airplayEvent: {
      findMany: (...args: unknown[]) => mockAirplayEventFindMany(...args),
      findUnique: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ ok: 1 }]),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      count: vi.fn().mockResolvedValue(1),
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
  ],
};

function makeEvent(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    stationId: 1,
    startedAt: new Date("2026-03-15T10:00:00Z"),
    endedAt: new Date("2026-03-15T10:03:00Z"),
    songTitle: `Song ${id}`,
    artistName: `Artist ${id}`,
    isrc: `ISRC${String(id).padStart(8, "0")}`,
    confidence: 0.95,
    playCount: 1,
    snippetUrl: null,
    createdAt: new Date("2026-03-15T10:00:00Z"),
    station: { name: "Test Radio" },
    ...overrides,
  };
}

describe("Airplay Events List Routes", () => {
  let server: Awaited<typeof import("../../src/index.js")>["server"];
  let adminToken: string;
  let stationToken: string;

  beforeEach(async () => {
    mockAirplayEventFindMany.mockClear();
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

  // --- GET /api/v1/airplay-events ---

  describe("GET /api/v1/airplay-events", () => {
    it("returns 401 without authentication", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/airplay-events",
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns paginated events with default limit (20)", async () => {
      // Return 21 events to signal hasMore=true
      const events = Array.from({ length: 21 }, (_, i) => makeEvent(100 - i));
      mockAirplayEventFindMany.mockResolvedValueOnce(events);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/airplay-events",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("nextCursor");
      expect(body.data).toHaveLength(20);
      expect(body.nextCursor).toBe(81); // last item id in sliced 20 (ids: 100,99,...,81)
    });

    it("returns null nextCursor when no more results", async () => {
      const events = [makeEvent(10), makeEvent(9)];
      mockAirplayEventFindMany.mockResolvedValueOnce(events);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/airplay-events",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(2);
      expect(body.nextCursor).toBeNull();
    });

    it("supports cursor-based pagination", async () => {
      const events = [makeEvent(49), makeEvent(48)];
      mockAirplayEventFindMany.mockResolvedValueOnce(events);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/airplay-events?cursor=50&limit=10",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(2);

      // Verify findMany was called with cursor filter (id < cursor)
      expect(mockAirplayEventFindMany).toHaveBeenCalled();
      const callArgs = mockAirplayEventFindMany.mock.calls[0][0];
      expect(callArgs.where.id).toEqual({ lt: 50 });
    });

    it("supports search by song title (q parameter)", async () => {
      const events = [makeEvent(1, { songTitle: "Smiley Song", artistName: "Smiley" })];
      mockAirplayEventFindMany.mockResolvedValueOnce(events);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/airplay-events?q=Smiley",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(1);

      // Verify search filter was applied via OR clause
      const callArgs = mockAirplayEventFindMany.mock.calls[0][0];
      expect(callArgs.where.OR).toBeDefined();
    });

    it("supports date range filtering (startDate, endDate)", async () => {
      mockAirplayEventFindMany.mockResolvedValueOnce([]);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/airplay-events?startDate=2026-03-01&endDate=2026-03-15",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      // Verify date range filter was applied
      const callArgs = mockAirplayEventFindMany.mock.calls[0][0];
      expect(callArgs.where.startedAt).toBeDefined();
      expect(callArgs.where.startedAt.gte).toBeInstanceOf(Date);
      expect(callArgs.where.startedAt.lte).toBeInstanceOf(Date);
    });

    it("supports station filtering (stationId)", async () => {
      mockAirplayEventFindMany.mockResolvedValueOnce([]);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/airplay-events?stationId=5",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      // Verify station filter was applied
      const callArgs = mockAirplayEventFindMany.mock.calls[0][0];
      expect(callArgs.where.stationId).toBe(5);
    });

    it("includes station name in results", async () => {
      const events = [makeEvent(1, { station: { name: "Radio ZU" } })];
      mockAirplayEventFindMany.mockResolvedValueOnce(events);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/airplay-events",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data[0].station).toMatchObject({ name: "Radio ZU" });

      // Verify include for station name
      const callArgs = mockAirplayEventFindMany.mock.calls[0][0];
      expect(callArgs.include).toMatchObject({ station: { select: { name: true } } });
    });

    it("orders results by startedAt DESC", async () => {
      mockAirplayEventFindMany.mockResolvedValueOnce([]);

      await server.inject({
        method: "GET",
        url: "/api/v1/airplay-events",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const callArgs = mockAirplayEventFindMany.mock.calls[0][0];
      expect(callArgs.orderBy).toMatchObject({ startedAt: "desc" });
    });

    it("STATION role user only sees events from scoped stations", async () => {
      mockAirplayEventFindMany.mockResolvedValueOnce([]);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/airplay-events",
        headers: { authorization: `Bearer ${stationToken}` },
      });

      expect(response.statusCode).toBe(200);

      // Verify station scope filter is applied (stationId IN scoped IDs)
      const callArgs = mockAirplayEventFindMany.mock.calls[0][0];
      expect(callArgs.where.stationId).toEqual({ in: [5] });
    });

    it("ADMIN user sees all events without station filter", async () => {
      mockAirplayEventFindMany.mockResolvedValueOnce([]);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/airplay-events",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      // Verify no station scope filter for admin
      const callArgs = mockAirplayEventFindMany.mock.calls[0][0];
      // Admin should not have stationId as an object with 'in' constraint
      expect(callArgs.where.stationId).toBeUndefined();
    });
  });
});
