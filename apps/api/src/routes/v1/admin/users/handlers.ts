import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../../../lib/prisma.js";
import type {
  UserParams,
  UpdateRoleBody,
  UpdateScopesBody,
} from "./schema.js";

/**
 * GET /admin/users - List all users with their scopes.
 */
export async function listUsers(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const users = await prisma.user.findMany({
    include: { scopes: true },
    orderBy: { createdAt: "desc" },
  });

  return reply.send(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      scopes: u.scopes.map((s) => ({
        entityType: s.entityType,
        entityId: s.entityId,
      })),
    })),
  );
}

/**
 * PATCH /admin/users/:id/deactivate - Deactivate a user and revoke all refresh tokens.
 */
export async function deactivateUser(
  request: FastifyRequest<{ Params: UserParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return reply.status(404).send({ error: "User not found" });
  }

  // Deactivate user and revoke all refresh tokens in a transaction
  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { isActive: false },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return reply.send({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  });
}

/**
 * PATCH /admin/users/:id/reactivate - Reactivate a deactivated user.
 */
export async function reactivateUser(
  request: FastifyRequest<{ Params: UserParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return reply.status(404).send({ error: "User not found" });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { isActive: true },
  });

  return reply.send({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  });
}

/**
 * PATCH /admin/users/:id/role - Update a user's role.
 */
export async function updateUserRole(
  request: FastifyRequest<{ Params: UserParams; Body: UpdateRoleBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params;
  const { role } = request.body;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return reply.status(404).send({ error: "User not found" });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role },
  });

  return reply.send({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  });
}

/**
 * PUT /admin/users/:id/scopes - Replace all user scopes with new entries.
 */
export async function updateUserScopes(
  request: FastifyRequest<{ Params: UserParams; Body: UpdateScopesBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params;
  const { scopes } = request.body;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return reply.status(404).send({ error: "User not found" });
  }

  // Delete existing scopes and create new ones in a transaction
  await prisma.$transaction([
    prisma.userScope.deleteMany({ where: { userId: id } }),
    ...scopes.map((scope) =>
      prisma.userScope.create({
        data: {
          userId: id,
          entityType: scope.entityType,
          entityId: scope.entityId,
        },
      }),
    ),
  ]);

  // Fetch updated scopes
  const updatedScopes = await prisma.userScope.findMany({
    where: { userId: id },
  });

  return reply.send({
    userId: id,
    scopes: updatedScopes.map((s) => ({
      entityType: s.entityType,
      entityId: s.entityId,
    })),
  });
}
