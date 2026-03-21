import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../../../lib/prisma.js";
import type {
  CreateMissingSongBody,
  UpdateMissingSongBody,
  MissingSongParams,
  ListMissingSongsQuery,
} from "./schema.js";

/**
 * POST /admin/missing-songs - Report a song missing from ACRCloud.
 */
export async function createReport(
  request: FastifyRequest<{ Body: CreateMissingSongBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { songTitle, artistName, isrc, youtubeUrl, spotifyUrl, notes } =
    request.body;

  const report = await prisma.missingSongReport.create({
    data: {
      songTitle,
      artistName,
      isrc: isrc || null,
      youtubeUrl: youtubeUrl || null,
      spotifyUrl: spotifyUrl || null,
      notes: notes || null,
      reportedBy: request.currentUser.id,
    },
    include: { reporter: { select: { name: true, email: true } } },
  });

  return reply.status(201).send(report);
}

/**
 * GET /admin/missing-songs - List all missing song reports.
 */
export async function listReports(
  request: FastifyRequest<{ Querystring: ListMissingSongsQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { status, cursor, limit: rawLimit } = request.query;
  const limit = rawLimit || 20;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (cursor) where.id = { lt: cursor };

  const reports = await prisma.missingSongReport.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: { reporter: { select: { name: true, email: true } } },
  });

  const hasMore = reports.length > limit;
  const data = hasMore ? reports.slice(0, limit) : reports;
  const nextCursor =
    hasMore && data.length > 0 ? data[data.length - 1].id : null;

  return reply.send({ data, nextCursor });
}

/**
 * PATCH /admin/missing-songs/:id - Update report status.
 */
export async function updateReport(
  request: FastifyRequest<{
    Params: MissingSongParams;
    Body: UpdateMissingSongBody;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params;
  const { status } = request.body;

  try {
    const report = await prisma.missingSongReport.update({
      where: { id },
      data: { status },
      include: { reporter: { select: { name: true, email: true } } },
    });
    return reply.send(report);
  } catch {
    return reply.status(404).send({ error: "Report not found" });
  }
}
