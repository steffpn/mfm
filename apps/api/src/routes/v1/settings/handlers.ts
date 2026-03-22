import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../../lib/prisma.js";
import type { UpdateSettingsBody } from "./schema.js";

/**
 * GET /settings - Get current user settings.
 */
export async function getSettings(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = request.currentUser;

  let settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
  });

  if (!settings) {
    settings = await prisma.userSettings.create({
      data: { userId: user.id },
    });
  }

  return reply.send(settings);
}

/**
 * PATCH /settings - Update current user settings.
 */
export async function updateSettings(
  request: FastifyRequest<{ Body: UpdateSettingsBody }>,
  reply: FastifyReply,
): Promise<void> {
  const user = request.currentUser;
  const data = request.body;

  const settings = await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });

  return reply.send(settings);
}
