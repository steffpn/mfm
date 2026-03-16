import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Prisma mock ----
const mockQueryRaw = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserUpdate = vi.fn();
const mockDeviceTokenUpsert = vi.fn();
const mockDeviceTokenDeleteMany = vi.fn();

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
      count: vi.fn().mockResolvedValue(1),
    },
    deviceToken: {
      upsert: (...args: unknown[]) => mockDeviceTokenUpsert(...args),
      deleteMany: (...args: unknown[]) => mockDeviceTokenDeleteMany(...args),
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
const mockUser = {
  id: 1,
  email: "user@test.com",
  name: "Test User",
  role: "ADMIN",
  isActive: true,
  dailyDigestEnabled: true,
  weeklyDigestEnabled: true,
  scopes: [{ id: 1, userId: 1, entityType: "STATION", entityId: 1 }],
};

describe("Notification Routes", () => {
  let server: Awaited<typeof import("../../src/index.js")>["server"];
  let authToken: string;

  beforeEach(async () => {
    mockQueryRaw.mockClear();
    mockUserFindUnique.mockClear();
    mockUserUpdate.mockClear();
    mockDeviceTokenUpsert.mockClear();
    mockDeviceTokenDeleteMany.mockClear();

    const mod = await import("../../src/index.js");
    server = mod.server;
    await server.ready();

    authToken = server.jwt.sign({ sub: mockUser.id });

    // Mock user lookup for authenticate middleware
    mockUserFindUnique.mockImplementation(({ where }: { where: { id: number } }) => {
      if (where.id === mockUser.id) return Promise.resolve(mockUser);
      return Promise.resolve(null);
    });
  });

  // --- GET /api/v1/notifications/preferences ---

  describe("GET /api/v1/notifications/preferences", () => {
    it("returns 401 without authentication", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/notifications/preferences",
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns default preferences (both true) for authenticated user", async () => {
      mockUserFindUnique.mockImplementation(({ where, select }: { where: { id: number }; select?: unknown }) => {
        if (where.id === mockUser.id) {
          if (select) {
            return Promise.resolve({
              dailyDigestEnabled: true,
              weeklyDigestEnabled: true,
            });
          }
          return Promise.resolve(mockUser);
        }
        return Promise.resolve(null);
      });

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/notifications/preferences",
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toMatchObject({
        dailyDigestEnabled: true,
        weeklyDigestEnabled: true,
      });
    });
  });

  // --- PUT /api/v1/notifications/preferences ---

  describe("PUT /api/v1/notifications/preferences", () => {
    it("returns 401 without authentication", async () => {
      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/notifications/preferences",
        payload: { dailyDigestEnabled: false },
      });

      expect(response.statusCode).toBe(401);
    });

    it("updates daily digest preference only", async () => {
      mockUserUpdate.mockResolvedValueOnce({
        dailyDigestEnabled: false,
        weeklyDigestEnabled: true,
      });

      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/notifications/preferences",
        headers: { authorization: `Bearer ${authToken}` },
        payload: { dailyDigestEnabled: false },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toMatchObject({
        dailyDigestEnabled: false,
        weeklyDigestEnabled: true,
      });
    });

    it("updates weekly digest preference only", async () => {
      mockUserUpdate.mockResolvedValueOnce({
        dailyDigestEnabled: true,
        weeklyDigestEnabled: false,
      });

      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/notifications/preferences",
        headers: { authorization: `Bearer ${authToken}` },
        payload: { weeklyDigestEnabled: false },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toMatchObject({
        dailyDigestEnabled: true,
        weeklyDigestEnabled: false,
      });
    });

    it("updates both preferences", async () => {
      mockUserUpdate.mockResolvedValueOnce({
        dailyDigestEnabled: false,
        weeklyDigestEnabled: false,
      });

      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/notifications/preferences",
        headers: { authorization: `Bearer ${authToken}` },
        payload: { dailyDigestEnabled: false, weeklyDigestEnabled: false },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toMatchObject({
        dailyDigestEnabled: false,
        weeklyDigestEnabled: false,
      });
    });
  });

  // --- POST /api/v1/notifications/device-token ---

  describe("POST /api/v1/notifications/device-token", () => {
    it("returns 401 without authentication", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/notifications/device-token",
        payload: { token: "abc123" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("creates a new device token and returns 201", async () => {
      mockDeviceTokenUpsert.mockResolvedValueOnce({
        id: 1,
        userId: mockUser.id,
        token: "new-token-abc",
        environment: "production",
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/notifications/device-token",
        headers: { authorization: `Bearer ${authToken}` },
        payload: { token: "new-token-abc" },
      });

      expect(response.statusCode).toBe(201);
      expect(mockDeviceTokenUpsert).toHaveBeenCalled();
    });

    it("upserts existing token to reassign to current user", async () => {
      mockDeviceTokenUpsert.mockResolvedValueOnce({
        id: 2,
        userId: mockUser.id,
        token: "existing-token",
        environment: "sandbox",
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/notifications/device-token",
        headers: { authorization: `Bearer ${authToken}` },
        payload: { token: "existing-token", environment: "sandbox" },
      });

      expect(response.statusCode).toBe(201);
      expect(mockDeviceTokenUpsert).toHaveBeenCalled();
    });

    it("returns 400 with empty token", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/notifications/device-token",
        headers: { authorization: `Bearer ${authToken}` },
        payload: { token: "" },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // --- DELETE /api/v1/notifications/device-token ---

  describe("DELETE /api/v1/notifications/device-token", () => {
    it("returns 401 without authentication", async () => {
      const response = await server.inject({
        method: "DELETE",
        url: "/api/v1/notifications/device-token",
        payload: { token: "some-token" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("deletes own device token and returns 204", async () => {
      mockDeviceTokenDeleteMany.mockResolvedValueOnce({ count: 1 });

      const response = await server.inject({
        method: "DELETE",
        url: "/api/v1/notifications/device-token",
        headers: { authorization: `Bearer ${authToken}` },
        payload: { token: "my-token" },
      });

      expect(response.statusCode).toBe(204);
      expect(mockDeviceTokenDeleteMany).toHaveBeenCalledWith({
        where: { token: "my-token", userId: mockUser.id },
      });
    });
  });
});
