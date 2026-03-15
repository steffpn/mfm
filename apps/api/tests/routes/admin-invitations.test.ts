import { describe, it, expect, afterAll, beforeAll, beforeEach } from "vitest";
import { server } from "../../src/index.js";
import { prisma } from "../../src/lib/prisma.js";
import {
  createTestAdmin,
  getAuthTokens,
  createTestUserWithTokens,
} from "../helpers/auth.js";

describe("Admin Invitation Routes", () => {
  let adminToken: string;

  beforeAll(async () => {
    await server.ready();
    const { user } = await createTestAdmin(server);
    const tokens = await getAuthTokens(server, "admin@test.com", "AdminPass123!");
    adminToken = tokens.accessToken;
  });

  beforeEach(async () => {
    // Clean invitations before each test (keep admin user)
    await prisma.invitation.deleteMany({});
  });

  afterAll(async () => {
    await prisma.invitation.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.userScope.deleteMany({});
    await prisma.user.deleteMany({});
    await server.close();
  });

  // --- POST /api/v1/admin/invitations ---

  describe("POST /api/v1/admin/invitations", () => {
    it("creates an invitation with role, scopeId, maxUses and returns 201", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/invitations",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          role: "ARTIST",
          scopeId: 42,
          maxUses: 5,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.code).toBeDefined();
      expect(body.code).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
      expect(body.role).toBe("ARTIST");
      expect(body.scopeId).toBe(42);
      expect(body.maxUses).toBe(5);
      expect(body.status).toBe("PENDING");
      expect(body.expiresAt).toBeDefined();
    });

    it("creates an invitation with defaults (maxUses=1, no scopeId)", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/invitations",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          role: "STATION",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.maxUses).toBe(1);
      expect(body.role).toBe("STATION");
    });

    it("returns 400 for invalid role", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/invitations",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          role: "SUPERUSER",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // --- GET /api/v1/admin/invitations ---

  describe("GET /api/v1/admin/invitations", () => {
    it("returns all invitations ordered by createdAt desc", async () => {
      // Create two invitations
      await server.inject({
        method: "POST",
        url: "/api/v1/admin/invitations",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { role: "ARTIST" },
      });
      await server.inject({
        method: "POST",
        url: "/api/v1/admin/invitations",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { role: "LABEL" },
      });

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/invitations",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveLength(2);
      // Most recent first
      expect(body[0].role).toBe("LABEL");
      expect(body[1].role).toBe("ARTIST");
    });
  });

  // --- PATCH /api/v1/admin/invitations/:id/revoke ---

  describe("PATCH /api/v1/admin/invitations/:id/revoke", () => {
    it("revokes an invitation by setting status to REVOKED", async () => {
      // Create invitation
      const createRes = await server.inject({
        method: "POST",
        url: "/api/v1/admin/invitations",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { role: "ARTIST" },
      });
      const invitation = JSON.parse(createRes.payload);

      const response = await server.inject({
        method: "PATCH",
        url: `/api/v1/admin/invitations/${invitation.id}/revoke`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe("REVOKED");
    });

    it("returns 404 for non-existent invitation", async () => {
      const response = await server.inject({
        method: "PATCH",
        url: "/api/v1/admin/invitations/99999/revoke",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // --- Auth enforcement ---

  describe("Auth enforcement", () => {
    it("returns 401 for unauthenticated request", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/invitations",
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 403 for non-admin user", async () => {
      const { accessToken } = await createTestUserWithTokens(
        server,
        "ARTIST",
        "artist-inv@test.com"
      );

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/invitations",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
