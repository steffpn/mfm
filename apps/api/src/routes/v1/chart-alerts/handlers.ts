import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../../lib/prisma.js";
import type { ChartAlertQuery, MarkReadBody } from "./schema.js";

/**
 * GET /chart-alerts - List chart alerts for the current user.
 */
export async function listChartAlerts(
  request: FastifyRequest<{ Querystring: ChartAlertQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const user = request.currentUser;
  const { unreadOnly, limit = 20 } = request.query;

  const alerts = await prisma.chartAlert.findMany({
    where: {
      userId: user.id,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { sentAt: "desc" },
    take: limit,
  });

  return reply.send(alerts);
}

/**
 * POST /chart-alerts/mark-read - Mark alerts as read.
 */
export async function markAlertsRead(
  request: FastifyRequest<{ Body: MarkReadBody }>,
  reply: FastifyReply,
): Promise<void> {
  const user = request.currentUser;
  const { alertIds } = request.body;

  await prisma.chartAlert.updateMany({
    where: { id: { in: alertIds }, userId: user.id },
    data: { isRead: true },
  });

  return reply.send({ success: true });
}
