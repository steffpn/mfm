import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../../lib/prisma.js";
import type {
  UpdatePreferencesBody,
  RegisterDeviceTokenBody,
  DeleteDeviceTokenBody,
} from "./schema.js";

/**
 * GET /notifications/preferences
 *
 * Returns the current user's notification preferences.
 */
export async function getNotificationPreferences(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: request.currentUser.id },
    select: {
      dailyDigestEnabled: true,
      weeklyDigestEnabled: true,
    },
  });

  if (!user) {
    return reply.code(404).send({ error: "User not found" });
  }

  return reply.send({
    dailyDigestEnabled: user.dailyDigestEnabled,
    weeklyDigestEnabled: user.weeklyDigestEnabled,
  });
}

/**
 * PUT /notifications/preferences
 *
 * Updates the current user's notification preferences (partial update).
 */
export async function updateNotificationPreferences(
  request: FastifyRequest<{ Body: UpdatePreferencesBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { dailyDigestEnabled, weeklyDigestEnabled } = request.body;

  const data: Record<string, boolean> = {};
  if (dailyDigestEnabled !== undefined) data.dailyDigestEnabled = dailyDigestEnabled;
  if (weeklyDigestEnabled !== undefined) data.weeklyDigestEnabled = weeklyDigestEnabled;

  const updated = await prisma.user.update({
    where: { id: request.currentUser.id },
    data,
    select: {
      dailyDigestEnabled: true,
      weeklyDigestEnabled: true,
    },
  });

  return reply.send({
    dailyDigestEnabled: updated.dailyDigestEnabled,
    weeklyDigestEnabled: updated.weeklyDigestEnabled,
  });
}

/**
 * POST /notifications/device-token
 *
 * Registers (or re-assigns) a device push token for the current user.
 */
export async function registerDeviceToken(
  request: FastifyRequest<{ Body: RegisterDeviceTokenBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { token, environment } = request.body;
  const userId = request.currentUser.id;

  await prisma.deviceToken.upsert({
    where: { token },
    update: { userId, environment: environment || "production" },
    create: { userId, token, environment: environment || "production" },
  });

  return reply.code(201).send({ success: true });
}

/**
 * DELETE /notifications/device-token
 *
 * Removes a device token owned by the current user.
 */
export async function deleteDeviceToken(
  request: FastifyRequest<{ Body: DeleteDeviceTokenBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { token } = request.body;
  const userId = request.currentUser.id;

  await prisma.deviceToken.deleteMany({
    where: { token, userId },
  });

  return reply.code(204).send();
}
