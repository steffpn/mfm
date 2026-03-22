import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../../lib/prisma.js";
import type { ReportQuery } from "./schema.js";

/**
 * GET /reports - List user's daily reports.
 */
export async function listReports(
  request: FastifyRequest<{ Querystring: ReportQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const user = request.currentUser;
  const { from, to, limit = 7 } = request.query;

  const where: Record<string, unknown> = { userId: user.id };
  if (from || to) {
    where.reportDate = {};
    if (from) (where.reportDate as Record<string, unknown>).gte = new Date(from);
    if (to) (where.reportDate as Record<string, unknown>).lte = new Date(to);
  }

  const reports = await prisma.dailyReport.findMany({
    where,
    orderBy: { reportDate: "desc" },
    take: limit,
  });

  return reply.send(reports);
}

/**
 * GET /reports/today - Get today's report for the current user.
 */
export async function todayReport(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = request.currentUser;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const report = await prisma.dailyReport.findUnique({
    where: { userId_reportDate: { userId: user.id, reportDate: today } },
  });

  if (!report) {
    return reply.send({ report: null, message: "Report not generated yet" });
  }

  return reply.send({ report, message: null });
}
