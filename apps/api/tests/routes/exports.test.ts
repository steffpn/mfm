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

describe("Export Routes", () => {
  let server: Awaited<typeof import("../../src/index.js")>["server"];
  let adminToken: string;
  let stationToken: string;

  beforeEach(async () => {
    mockAirplayEventFindMany.mockClear();
    mockUserFindUnique.mockClear();

    const mod = await import("../../src/index.js");
    server = mod.server;
    await server.ready();

    adminToken = server.jwt.sign({ sub: mockAdminUser.id });
    stationToken = server.jwt.sign({ sub: mockStationUser.id });

    mockUserFindUnique.mockImplementation(({ where }: { where: { id: number } }) => {
      if (where.id === mockAdminUser.id) return Promise.resolve(mockAdminUser);
      if (where.id === mockStationUser.id) return Promise.resolve(mockStationUser);
      return Promise.resolve(null);
    });
  });

  // --- CSV Export Tests ---

  describe("GET /api/v1/exports/csv", () => {
    it("returns 401 without auth token", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/exports/csv",
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 200 with Content-Type: text/csv", async () => {
      mockAirplayEventFindMany.mockResolvedValueOnce([makeEvent(1)]);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/exports/csv",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/csv");
    });

    it("includes Content-Disposition header with filename", async () => {
      mockAirplayEventFindMany.mockResolvedValueOnce([makeEvent(1)]);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/exports/csv",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-disposition"]).toContain("attachment");
      expect(response.headers["content-disposition"]).toContain("airplay-export.csv");
    });

    it("contains header row with correct columns", async () => {
      mockAirplayEventFindMany.mockResolvedValueOnce([makeEvent(1)]);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/exports/csv",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const lines = response.payload.split("\n");
      const header = lines[0];
      expect(header).toContain("Song Title");
      expect(header).toContain("Artist");
      expect(header).toContain("Station");
      expect(header).toContain("ISRC");
      expect(header).toContain("Started At");
      expect(header).toContain("Ended At");
      expect(header).toContain("Play Count");
    });

    it("contains data rows matching queried events", async () => {
      const events = [
        makeEvent(1, { songTitle: "My Song", artistName: "My Artist", station: { name: "Radio ZU" }, isrc: "ROABC123", playCount: 3 }),
        makeEvent(2, { songTitle: "Another Song", artistName: "Another Artist", station: { name: "Kiss FM" }, isrc: null, playCount: 1 }),
      ];
      mockAirplayEventFindMany.mockResolvedValueOnce(events);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/exports/csv",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.payload;
      expect(payload).toContain("My Song");
      expect(payload).toContain("My Artist");
      expect(payload).toContain("Radio ZU");
      expect(payload).toContain("ROABC123");
      expect(payload).toContain("Another Song");
      expect(payload).toContain("Kiss FM");
    });

    it("applies q, startDate, endDate, stationId query filters", async () => {
      mockAirplayEventFindMany.mockResolvedValueOnce([]);

      await server.inject({
        method: "GET",
        url: "/api/v1/exports/csv?q=Smiley&startDate=2026-03-01&endDate=2026-03-15&stationId=5",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(mockAirplayEventFindMany).toHaveBeenCalled();
      const callArgs = mockAirplayEventFindMany.mock.calls[0][0];
      expect(callArgs.where.OR).toBeDefined();
      expect(callArgs.where.startedAt).toBeDefined();
      expect(callArgs.where.stationId).toBe(5);
    });

    it("STATION role user export only contains events from scoped station IDs", async () => {
      mockAirplayEventFindMany.mockResolvedValueOnce([]);

      await server.inject({
        method: "GET",
        url: "/api/v1/exports/csv",
        headers: { authorization: `Bearer ${stationToken}` },
      });

      expect(mockAirplayEventFindMany).toHaveBeenCalled();
      const callArgs = mockAirplayEventFindMany.mock.calls[0][0];
      expect(callArgs.where.stationId).toEqual({ in: [5] });
    });

    it("ADMIN role user export contains all events without scope restriction", async () => {
      mockAirplayEventFindMany.mockResolvedValueOnce([]);

      await server.inject({
        method: "GET",
        url: "/api/v1/exports/csv",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(mockAirplayEventFindMany).toHaveBeenCalled();
      const callArgs = mockAirplayEventFindMany.mock.calls[0][0];
      expect(callArgs.where.stationId).toBeUndefined();
    });

    it("caps results at 10,000 rows and returns 400 if exceeded", async () => {
      // Return 10001 events to simulate exceeding the limit
      const events = Array.from({ length: 10001 }, (_, i) => makeEvent(i + 1));
      mockAirplayEventFindMany.mockResolvedValueOnce(events);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/exports/csv",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toContain("10,000");
    });

    it("sanitizes CSV values starting with formula injection characters", async () => {
      const events = [
        makeEvent(1, { songTitle: "=SUM(A1)", artistName: "+exploit", station: { name: "-station" }, isrc: "@cmd" }),
      ];
      mockAirplayEventFindMany.mockResolvedValueOnce(events);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/exports/csv",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.payload;
      // Values starting with =, +, -, @ should be prefixed with single quote
      expect(payload).toContain("'=SUM(A1)");
      expect(payload).toContain("'+exploit");
      expect(payload).toContain("'-station");
      expect(payload).toContain("'@cmd");
    });
  });

  // --- PDF Export Tests ---

  describe("GET /api/v1/exports/pdf", () => {
    it("returns 401 without auth token", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/exports/pdf?startDate=2026-03-01&endDate=2026-03-15",
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 400 when startDate is missing", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/exports/pdf?endDate=2026-03-15",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 when endDate is missing", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/exports/pdf?startDate=2026-03-01",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    // Extended timeout: first PDF request triggers lazy pdfkit import (~90s in dev)
    it("returns 200 with Content-Type: application/pdf", async () => {
      mockAirplayEventFindMany.mockResolvedValueOnce([makeEvent(1)]);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/exports/pdf?startDate=2026-03-01&endDate=2026-03-15",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/pdf");
    }, 120000);

    it("includes Content-Disposition header with filename containing date range", async () => {
      mockAirplayEventFindMany.mockResolvedValueOnce([makeEvent(1)]);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/exports/pdf?startDate=2026-03-01&endDate=2026-03-15",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-disposition"]).toContain("attachment");
      expect(response.headers["content-disposition"]).toContain("2026-03-01");
      expect(response.headers["content-disposition"]).toContain("2026-03-15");
    });

    it("response body starts with %PDF magic bytes", async () => {
      mockAirplayEventFindMany.mockResolvedValueOnce([makeEvent(1)]);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/exports/pdf?startDate=2026-03-01&endDate=2026-03-15",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.rawPayload.subarray(0, 4).toString()).toBe("%PDF");
    });

    it("applies q and stationId query filters", async () => {
      mockAirplayEventFindMany.mockResolvedValueOnce([]);

      await server.inject({
        method: "GET",
        url: "/api/v1/exports/pdf?startDate=2026-03-01&endDate=2026-03-15&q=Smiley&stationId=5",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(mockAirplayEventFindMany).toHaveBeenCalled();
      const callArgs = mockAirplayEventFindMany.mock.calls[0][0];
      expect(callArgs.where.OR).toBeDefined();
      expect(callArgs.where.stationId).toBe(5);
    });

    it("STATION role user PDF only contains scoped station events", async () => {
      mockAirplayEventFindMany.mockResolvedValueOnce([]);

      await server.inject({
        method: "GET",
        url: "/api/v1/exports/pdf?startDate=2026-03-01&endDate=2026-03-15",
        headers: { authorization: `Bearer ${stationToken}` },
      });

      expect(mockAirplayEventFindMany).toHaveBeenCalled();
      const callArgs = mockAirplayEventFindMany.mock.calls[0][0];
      expect(callArgs.where.stationId).toEqual({ in: [5] });
    });

    it("ADMIN role user PDF contains all events", async () => {
      mockAirplayEventFindMany.mockResolvedValueOnce([]);

      await server.inject({
        method: "GET",
        url: "/api/v1/exports/pdf?startDate=2026-03-01&endDate=2026-03-15",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(mockAirplayEventFindMany).toHaveBeenCalled();
      const callArgs = mockAirplayEventFindMany.mock.calls[0][0];
      expect(callArgs.where.stationId).toBeUndefined();
    });

    it("caps at 1,000 rows and returns 400 if exceeded", async () => {
      const events = Array.from({ length: 1001 }, (_, i) => makeEvent(i + 1));
      mockAirplayEventFindMany.mockResolvedValueOnce(events);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/exports/pdf?startDate=2026-03-01&endDate=2026-03-15",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toContain("1,000");
    });
  });
});
