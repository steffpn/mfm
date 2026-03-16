import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Prisma mock ----
const mockUserFindUnique = vi.fn();

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
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
const mockSubscribe = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn();
const mockDisconnect = vi.fn();
const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);
const mockRemoveAllListeners = vi.fn();
const mockZrangebyscore = vi.fn().mockResolvedValue([]);

vi.mock("../../src/lib/redis.js", () => ({
  createRedisConnection: vi.fn().mockReturnValue({
    subscribe: (...args: unknown[]) => mockSubscribe(...args),
    on: (...args: unknown[]) => mockOn(...args),
    disconnect: (...args: unknown[]) => mockDisconnect(...args),
    unsubscribe: (...args: unknown[]) => mockUnsubscribe(...args),
    removeAllListeners: (...args: unknown[]) => mockRemoveAllListeners(...args),
  }),
  redis: {
    ping: vi.fn().mockResolvedValue("PONG"),
    disconnect: vi.fn(),
    zrangebyscore: (...args: unknown[]) => mockZrangebyscore(...args),
  },
}));

// ---- Test users ----
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

const mockDeactivatedUser = {
  id: 3,
  email: "deactivated@test.com",
  name: "Deactivated User",
  role: "STATION",
  isActive: false,
  scopes: [],
};

describe("Live Feed SSE Route", () => {
  let server: Awaited<typeof import("../../src/index.js")>["server"];
  let adminToken: string;
  let stationToken: string;
  let deactivatedToken: string;

  beforeEach(async () => {
    mockUserFindUnique.mockClear();
    mockSubscribe.mockClear();
    mockOn.mockClear();
    mockDisconnect.mockClear();
    mockUnsubscribe.mockClear();
    mockZrangebyscore.mockClear();

    const mod = await import("../../src/index.js");
    server = mod.server;
    await server.ready();

    // Generate JWT tokens using the server's jwt plugin
    adminToken = server.jwt.sign({ sub: mockAdminUser.id });
    stationToken = server.jwt.sign({ sub: mockStationUser.id });
    deactivatedToken = server.jwt.sign({ sub: mockDeactivatedUser.id });

    // Mock user lookup
    mockUserFindUnique.mockImplementation(
      ({ where }: { where: { id: number } }) => {
        if (where.id === mockAdminUser.id)
          return Promise.resolve(mockAdminUser);
        if (where.id === mockStationUser.id)
          return Promise.resolve(mockStationUser);
        if (where.id === mockDeactivatedUser.id)
          return Promise.resolve(mockDeactivatedUser);
        return Promise.resolve(null);
      },
    );
  });

  // Test 1: GET /v1/live-feed without ?token returns 401
  it("returns 401 without token query parameter", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/live-feed",
      headers: { accept: "text/event-stream" },
    });

    expect(response.statusCode).toBe(401);
  });

  // Test 2: GET /v1/live-feed with invalid JWT token returns 401
  it("returns 401 with invalid JWT token", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/live-feed?token=invalid-garbage-token",
      headers: { accept: "text/event-stream" },
    });

    expect(response.statusCode).toBe(401);
  });

  // Test 3: GET /v1/live-feed with valid token for deactivated user returns 401
  it("returns 401 for deactivated user", async () => {
    const response = await server.inject({
      method: "GET",
      url: `/api/v1/live-feed?token=${deactivatedToken}`,
      headers: { accept: "text/event-stream" },
    });

    expect(response.statusCode).toBe(401);
  });

  // Test 4: GET /v1/live-feed with valid ADMIN token returns 200 with Content-Type text/event-stream
  it("returns 200 with text/event-stream for valid ADMIN token", async () => {
    const response = await server.inject({
      method: "GET",
      url: `/api/v1/live-feed?token=${adminToken}`,
      headers: { accept: "text/event-stream" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/event-stream");

    // Verify Redis subscriber was set up
    expect(mockSubscribe).toHaveBeenCalledWith("detection:new");
    expect(mockOn).toHaveBeenCalledWith("message", expect.any(Function));
  });

  // Test 5: GET /v1/live-feed with valid STATION token returns 200 with Content-Type text/event-stream
  it("returns 200 with text/event-stream for valid STATION token", async () => {
    const response = await server.inject({
      method: "GET",
      url: `/api/v1/live-feed?token=${stationToken}`,
      headers: { accept: "text/event-stream" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/event-stream");

    // Verify Redis subscriber was set up
    expect(mockSubscribe).toHaveBeenCalledWith("detection:new");
  });

  // Test 6: Backfill replay queries Redis with correct parameters when Last-Event-ID is provided
  it("queries Redis backfill sorted set with correct range when Last-Event-ID is provided", async () => {
    // Return empty array so no SSE writes happen (avoids inject timeout with keepAlive)
    mockZrangebyscore.mockResolvedValueOnce([]);

    const response = await server.inject({
      method: "GET",
      url: `/api/v1/live-feed?token=${adminToken}`,
      headers: {
        accept: "text/event-stream",
        "last-event-id": "49",
      },
    });

    expect(response.statusCode).toBe(200);

    // Verify Redis was queried with lastEventId + 1 through +inf
    expect(mockZrangebyscore).toHaveBeenCalledWith(
      "live-feed:recent",
      50,
      "+inf",
    );

    // Verify the SSE connection was still established after replay
    expect(mockSubscribe).toHaveBeenCalledWith("detection:new");
  });
});
