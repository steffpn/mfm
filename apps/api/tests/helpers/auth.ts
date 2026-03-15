import type { FastifyInstance } from "fastify";
import { prisma } from "../../src/lib/prisma.js";
import { hashPassword, generateTokenPair } from "../../src/lib/auth.js";

/**
 * Creates an admin user directly in the database with a hashed password.
 * Useful for test setup when you need an admin user without going through the registration flow.
 */
export async function createTestAdmin(
  fastify: FastifyInstance,
  email = "admin@test.com",
  password = "AdminPass123!"
): Promise<{
  user: { id: number; email: string; name: string; role: string };
}> {
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "Test Admin",
      role: "ADMIN",
      isActive: true,
    },
  });

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

/**
 * Logs in a user via the auth/login endpoint and returns tokens.
 * The user must already exist in the database.
 */
export async function getAuthTokens(
  fastify: FastifyInstance,
  email: string,
  password: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  user: { id: number; email: string; name: string; role: string };
}> {
  const response = await fastify.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });

  if (response.statusCode !== 200) {
    throw new Error(
      `Login failed with status ${response.statusCode}: ${response.payload}`
    );
  }

  const body = JSON.parse(response.payload);
  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    user: body.user,
  };
}

/**
 * Creates a user directly in the database and generates tokens for them.
 * Bypasses the registration flow entirely -- useful for tests that need
 * an authenticated user without invitation codes.
 */
export async function createTestUserWithTokens(
  fastify: FastifyInstance,
  role = "ARTIST",
  email = "testuser@test.com"
): Promise<{
  user: { id: number; email: string; name: string; role: string };
  accessToken: string;
  refreshToken: string;
}> {
  const passwordHash = await hashPassword("TestPass123!");

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "Test User",
      role,
      isActive: true,
    },
  });

  const tokens = await generateTokenPair(fastify, user.id);

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}
