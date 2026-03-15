import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { server } from "../../src/index.js";
import { hashPassword } from "../../src/lib/auth.js";
import { INVITE_CODE_EXPIRY_DAYS } from "@myfuckingmusic/shared";

/**
 * Helper: create an invitation directly in the DB for test setup.
 */
async function createTestInvitation(
  createdById: number,
  overrides: {
    code?: string;
    role?: string;
    scopeId?: number | null;
    status?: string;
    maxUses?: number;
    usedCount?: number;
    expiresAt?: Date;
  } = {}
) {
  return prisma.invitation.create({
    data: {
      code: overrides.code ?? `TEST-${Date.now().toString(16).slice(-4).toUpperCase()}-ABCD`,
      role: overrides.role ?? "ARTIST",
      scopeId: overrides.scopeId ?? null,
      status: overrides.status ?? "PENDING",
      createdById,
      maxUses: overrides.maxUses ?? 1,
      usedCount: overrides.usedCount ?? 0,
      expiresAt:
        overrides.expiresAt ??
        new Date(Date.now() + INVITE_CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    },
  });
}

describe("Auth Routes", () => {
  let adminUser: { id: number; email: string };

  beforeAll(async () => {
    await server.ready();
    // Create an admin user to serve as invitation creator
    const passwordHash = await hashPassword("AdminPass123!");
    const user = await prisma.user.create({
      data: {
        email: "auth-routes-admin@test.com",
        passwordHash,
        name: "Auth Routes Admin",
        role: "ADMIN",
        isActive: true,
      },
    });
    adminUser = { id: user.id, email: user.email };
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({});
    await prisma.userScope.deleteMany({});
    await prisma.invitation.deleteMany({});
    await prisma.user.deleteMany({});
    await server.close();
  });

  describe("POST /api/v1/auth/register", () => {
    beforeEach(async () => {
      // Clean up everything except admin user
      await prisma.refreshToken.deleteMany({});
      await prisma.userScope.deleteMany({});
      await prisma.invitation.deleteMany({});
      await prisma.user.deleteMany({ where: { id: { not: adminUser.id } } });
    });

    it("registers a user with a valid invitation code and returns 201 with tokens", async () => {
      const invitation = await createTestInvitation(adminUser.id, {
        code: "ABCD-EFGH-IJKL",
        role: "ARTIST",
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          code: "ABCD-EFGH-IJKL",
          email: "newuser@test.com",
          password: "SecurePass123!",
          name: "New User",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe("newuser@test.com");
      expect(body.user.name).toBe("New User");
      expect(body.user.role).toBe("ARTIST");
      expect(body.accessToken).toBeDefined();
      expect(typeof body.accessToken).toBe("string");
      expect(body.refreshToken).toBeDefined();
      expect(typeof body.refreshToken).toBe("string");
    });

    it("returns 400 for an invalid invitation code", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          code: "XXXX-YYYY-ZZZZ",
          email: "nobody@test.com",
          password: "SecurePass123!",
          name: "Nobody",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBeDefined();
    });

    it("returns 400 for an expired invitation code", async () => {
      await createTestInvitation(adminUser.id, {
        code: "EXPD-EXPD-EXPD",
        expiresAt: new Date(Date.now() - 1000), // expired
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          code: "EXPD-EXPD-EXPD",
          email: "expired@test.com",
          password: "SecurePass123!",
          name: "Expired",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 for an exhausted invitation code (usedCount >= maxUses)", async () => {
      await createTestInvitation(adminUser.id, {
        code: "USED-USED-USED",
        maxUses: 1,
        usedCount: 1,
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          code: "USED-USED-USED",
          email: "exhausted@test.com",
          password: "SecurePass123!",
          name: "Exhausted",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 409 for duplicate email", async () => {
      await createTestInvitation(adminUser.id, {
        code: "DUPL-DUPL-DUPL",
      });

      // Create user with same email
      await prisma.user.create({
        data: {
          email: "duplicate@test.com",
          passwordHash: "dummy",
          name: "Existing",
          role: "ARTIST",
        },
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          code: "DUPL-DUPL-DUPL",
          email: "duplicate@test.com",
          password: "SecurePass123!",
          name: "Duplicate",
        },
      });

      expect(response.statusCode).toBe(409);
    });

    it("increments usedCount and sets status to REDEEMED when maxUses reached", async () => {
      await createTestInvitation(adminUser.id, {
        code: "MULT-MULT-MULT",
        maxUses: 2,
        usedCount: 1,
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          code: "MULT-MULT-MULT",
          email: "multiuse@test.com",
          password: "SecurePass123!",
          name: "Multi Use",
        },
      });

      expect(response.statusCode).toBe(201);

      const updatedInvitation = await prisma.invitation.findUnique({
        where: { code: "MULT-MULT-MULT" },
      });
      expect(updatedInvitation!.usedCount).toBe(2);
      expect(updatedInvitation!.status).toBe("REDEEMED");
    });

    it("creates UserScope from invitation scopeId if present", async () => {
      await createTestInvitation(adminUser.id, {
        code: "SCOP-SCOP-SCOP",
        role: "ARTIST",
        scopeId: 42,
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          code: "SCOP-SCOP-SCOP",
          email: "scoped@test.com",
          password: "SecurePass123!",
          name: "Scoped User",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);

      const scopes = await prisma.userScope.findMany({
        where: { userId: body.user.id },
      });
      expect(scopes).toHaveLength(1);
      expect(scopes[0].entityType).toBe("ARTIST");
      expect(scopes[0].entityId).toBe(42);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    beforeEach(async () => {
      await prisma.refreshToken.deleteMany({});
      await prisma.userScope.deleteMany({});
      await prisma.invitation.deleteMany({});
      await prisma.user.deleteMany({ where: { id: { not: adminUser.id } } });
    });

    it("returns 200 with tokens for valid credentials", async () => {
      const passwordHash = await hashPassword("LoginPass123!");
      await prisma.user.create({
        data: {
          email: "login@test.com",
          passwordHash,
          name: "Login User",
          role: "ARTIST",
          isActive: true,
        },
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "login@test.com",
          password: "LoginPass123!",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe("login@test.com");
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
    });

    it("returns 401 for wrong password", async () => {
      const passwordHash = await hashPassword("RealPassword!");
      await prisma.user.create({
        data: {
          email: "wrongpass@test.com",
          passwordHash,
          name: "Wrong Pass",
          role: "ARTIST",
          isActive: true,
        },
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "wrongpass@test.com",
          password: "WrongPassword!",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("Invalid credentials");
    });

    it("returns 401 for non-existent email", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "nonexistent@test.com",
          password: "AnyPassword123!",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("Invalid credentials");
    });

    it("returns 401 for deactivated user", async () => {
      const passwordHash = await hashPassword("DeactivatedPass!");
      await prisma.user.create({
        data: {
          email: "deactivated@test.com",
          passwordHash,
          name: "Deactivated",
          role: "ARTIST",
          isActive: false,
        },
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "deactivated@test.com",
          password: "DeactivatedPass!",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("Invalid credentials");
    });

    it("updates lastLoginAt timestamp on successful login", async () => {
      const passwordHash = await hashPassword("LoginTime!");
      const user = await prisma.user.create({
        data: {
          email: "logintime@test.com",
          passwordHash,
          name: "Login Time",
          role: "ARTIST",
          isActive: true,
        },
      });

      expect(user.lastLoginAt).toBeNull();

      await server.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "logintime@test.com",
          password: "LoginTime!",
        },
      });

      const updated = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(updated!.lastLoginAt).not.toBeNull();
      expect(updated!.lastLoginAt).toBeInstanceOf(Date);
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    beforeEach(async () => {
      await prisma.refreshToken.deleteMany({});
      await prisma.userScope.deleteMany({});
      await prisma.invitation.deleteMany({});
      await prisma.user.deleteMany({ where: { id: { not: adminUser.id } } });
    });

    it("returns 200 with new tokens for a valid refresh token", async () => {
      const passwordHash = await hashPassword("RefreshPass!");
      const user = await prisma.user.create({
        data: {
          email: "refresh@test.com",
          passwordHash,
          name: "Refresh User",
          role: "ARTIST",
          isActive: true,
        },
      });

      // Create a refresh token directly in DB
      const refreshTokenValue = "valid-refresh-token-" + Date.now();
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshTokenValue,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: { refreshToken: refreshTokenValue },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      // New refresh token should be different from old one
      expect(body.refreshToken).not.toBe(refreshTokenValue);
    });

    it("rotates refresh token (old one revoked, new one created)", async () => {
      const passwordHash = await hashPassword("RotatePass!");
      const user = await prisma.user.create({
        data: {
          email: "rotate@test.com",
          passwordHash,
          name: "Rotate User",
          role: "ARTIST",
          isActive: true,
        },
      });

      const oldTokenValue = "old-refresh-token-" + Date.now();
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: oldTokenValue,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: { refreshToken: oldTokenValue },
      });

      expect(response.statusCode).toBe(200);

      // Old token should be revoked
      const oldToken = await prisma.refreshToken.findUnique({
        where: { token: oldTokenValue },
      });
      expect(oldToken!.revokedAt).not.toBeNull();

      // New token should exist in DB
      const body = JSON.parse(response.payload);
      const newToken = await prisma.refreshToken.findUnique({
        where: { token: body.refreshToken },
      });
      expect(newToken).not.toBeNull();
      expect(newToken!.revokedAt).toBeNull();
    });

    it("returns 401 for a revoked refresh token", async () => {
      const passwordHash = await hashPassword("RevokedPass!");
      const user = await prisma.user.create({
        data: {
          email: "revoked@test.com",
          passwordHash,
          name: "Revoked User",
          role: "ARTIST",
          isActive: true,
        },
      });

      const revokedTokenValue = "revoked-refresh-token-" + Date.now();
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: revokedTokenValue,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          revokedAt: new Date(), // already revoked
        },
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: { refreshToken: revokedTokenValue },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("Invalid refresh token");
    });

    it("returns 401 for an expired refresh token", async () => {
      const passwordHash = await hashPassword("ExpiredRefreshPass!");
      const user = await prisma.user.create({
        data: {
          email: "expired-refresh@test.com",
          passwordHash,
          name: "Expired Refresh",
          role: "ARTIST",
          isActive: true,
        },
      });

      const expiredTokenValue = "expired-refresh-token-" + Date.now();
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: expiredTokenValue,
          expiresAt: new Date(Date.now() - 1000), // expired
        },
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: { refreshToken: expiredTokenValue },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("Invalid refresh token");
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    beforeEach(async () => {
      await prisma.refreshToken.deleteMany({});
      await prisma.userScope.deleteMany({});
      await prisma.invitation.deleteMany({});
      await prisma.user.deleteMany({ where: { id: { not: adminUser.id } } });
    });

    it("revokes the provided refresh token and returns 200", async () => {
      const passwordHash = await hashPassword("LogoutPass!");
      const user = await prisma.user.create({
        data: {
          email: "logout@test.com",
          passwordHash,
          name: "Logout User",
          role: "ARTIST",
          isActive: true,
        },
      });

      // Create a refresh token
      const logoutTokenValue = "logout-refresh-token-" + Date.now();
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: logoutTokenValue,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Get an access token for auth header
      const accessToken = server.jwt.sign({ sub: user.id });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { refreshToken: logoutTokenValue },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.message).toBe("Logged out");

      // Verify token is revoked
      const revokedToken = await prisma.refreshToken.findUnique({
        where: { token: logoutTokenValue },
      });
      expect(revokedToken!.revokedAt).not.toBeNull();
    });

    it("returns 401 when no auth header is provided", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        payload: { refreshToken: "any-token" },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
