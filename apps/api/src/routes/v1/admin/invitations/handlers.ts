import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../../../lib/prisma.js";
import { generateInviteCode } from "../../../../lib/auth.js";
import { INVITE_CODE_EXPIRY_DAYS } from "@myfuckingmusic/shared";
import type { CreateInvitationBody, InvitationParams } from "./schema.js";

/**
 * POST /admin/invitations - Create a new invitation code.
 * Generates a unique code, sets 7-day expiry, and stores in DB.
 */
export async function createInvitation(
  request: FastifyRequest<{ Body: CreateInvitationBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { role, scopeId, maxUses = 1 } = request.body;
  const code = generateInviteCode();

  const expiresAt = new Date(
    Date.now() + INVITE_CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  const invitation = await prisma.invitation.create({
    data: {
      code,
      role,
      scopeId: scopeId ?? null,
      maxUses,
      expiresAt,
      createdById: request.currentUser.id,
      status: "PENDING",
    },
  });

  return reply.status(201).send(invitation);
}

/**
 * GET /admin/invitations - List all invitations ordered by createdAt desc.
 */
export async function listInvitations(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const invitations = await prisma.invitation.findMany({
    orderBy: { createdAt: "desc" },
  });

  return reply.send(invitations);
}

/**
 * PATCH /admin/invitations/:id/revoke - Set invitation status to REVOKED.
 */
export async function revokeInvitation(
  request: FastifyRequest<{ Params: InvitationParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params;

  const existing = await prisma.invitation.findUnique({ where: { id } });
  if (!existing) {
    return reply.status(404).send({ error: "Invitation not found" });
  }

  const invitation = await prisma.invitation.update({
    where: { id },
    data: { status: "REVOKED" },
  });

  return reply.send(invitation);
}
