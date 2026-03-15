import { describe, it, expect, afterAll, beforeAll, beforeEach } from "vitest";
import { server } from "../../src/index.js";
import { prisma } from "../../src/lib/prisma.js";
import {
  createTestAdmin,
  getAuthTokens,
  createTestUserWithTokens,
} from "../helpers/auth.js";

describe("Admin User Routes", () => {
  let adminToken: string;

  beforeAll(async () => {
    await server.ready();
    const { user } = await createTestAdmin(server);
    const tokens = await getAuthTokens(server, "admin@test.com", "AdminPass123!");
    adminToken = tokens.accessToken;
  });

  beforeEach(async () => {
    // Clean up non-admin users and their scopes before each test
    const adminUser = await prisma.user.findUnique({
      where: { email: "admin@test.com" },
    });
    if (adminUser) {
      await prisma.userScope.deleteMany({
        where: { userId: { not: adminUser.id } },
      });
      await prisma.refreshToken.deleteMany({
        where: { userId: { not: adminUser.id } },
      });
      await prisma.user.deleteMany({
        where: { id: { not: adminUser.id } },
      });
    }
  });

  afterAll(async () => {
    await prisma.invitation.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.userScope.deleteMany({});
    await prisma.user.deleteMany({});
    await server.close();
  });

  // --- GET /api/v1/admin/users ---

  describe("GET /api/v1/admin/users", () => {
    it("returns all users with their scopes", async () => {
      // Create a user with scopes
      const { user } = await createTestUserWithTokens(
        server,
        "STATION",
        "station-user@test.com"
      );
      await prisma.userScope.create({
        data: { userId: user.id, entityType: "STATION", entityId: 1 },
      });

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/users",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.length).toBeGreaterThanOrEqual(2); // admin + station user
      const stationUser = body.find(
        (u: { email: string }) => u.email === "station-user@test.com"
      );
      expect(stationUser).toBeDefined();
      expect(stationUser.scopes).toHaveLength(1);
      expect(stationUser.scopes[0].entityType).toBe("STATION");
    });
  });

  // --- PATCH /api/v1/admin/users/:id/deactivate ---

  describe("PATCH /api/v1/admin/users/:id/deactivate", () => {
    it("deactivates a user and revokes all refresh tokens", async () => {
      const { user, refreshToken } = await createTestUserWithTokens(
        server,
        "ARTIST",
        "deactivate-me@test.com"
      );

      const response = await server.inject({
        method: "PATCH",
        url: `/api/v1/admin/users/${user.id}/deactivate`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.isActive).toBe(false);

      // Verify refresh tokens are revoked
      const tokens = await prisma.refreshToken.findMany({
        where: { userId: user.id },
      });
      expect(tokens.every((t) => t.revokedAt !== null)).toBe(true);
    });

    it("returns 404 for non-existent user", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: "/api/v1/admin/users/99999/deactivate",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // --- PATCH /api/v1/admin/users/:id/reactivate ---

  describe("PATCH /api/v1/admin/users/:id/reactivate", () => {
    it("reactivates a deactivated user", async () => {
      const { user } = await createTestUserWithTokens(
        server,
        "ARTIST",
        "reactivate-me@test.com"
      );
      // Deactivate first
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      });

      const response = await server.inject({
        method: "PATCH",
        url: `/api/v1/admin/users/${user.id}/reactivate`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.isActive).toBe(true);
    });
  });

  // --- PATCH /api/v1/admin/users/:id/role ---

  describe("PATCH /api/v1/admin/users/:id/role", () => {
    it("updates a user's role", async () => {
      const { user } = await createTestUserWithTokens(
        server,
        "ARTIST",
        "role-change@test.com"
      );

      const response = await server.inject({
        method: "PATCH",
        url: `/api/v1/admin/users/${user.id}/role`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { role: "LABEL" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.role).toBe("LABEL");
    });
  });

  // --- PUT /api/v1/admin/users/:id/scopes ---

  describe("PUT /api/v1/admin/users/:id/scopes", () => {
    it("replaces user scopes with new entries", async () => {
      const { user } = await createTestUserWithTokens(
        server,
        "STATION",
        "scope-update@test.com"
      );
      // Add initial scope
      await prisma.userScope.create({
        data: { userId: user.id, entityType: "STATION", entityId: 1 },
      });

      const response = await server.inject({
        method: "PUT",
        url: `/api/v1/admin/users/${user.id}/scopes`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          scopes: [
            { entityType: "STATION", entityId: 10 },
            { entityType: "STATION", entityId: 20 },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.scopes).toHaveLength(2);

      // Verify old scope was removed
      const allScopes = await prisma.userScope.findMany({
        where: { userId: user.id },
      });
      expect(allScopes).toHaveLength(2);
      expect(allScopes.map((s) => s.entityId).sort()).toEqual([10, 20]);
    });
  });

  // --- Auth enforcement ---

  describe("Auth enforcement", () => {
    it("returns 401 for unauthenticated request", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/users",
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 403 for non-admin user", async () => {
      const { accessToken } = await createTestUserWithTokens(
        server,
        "ARTIST",
        "artist-users@test.com"
      );

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/users",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
