import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../../lib/prisma.js";
import { getPresignedUrl } from "../../../lib/r2.js";
import type { AirplayEventParams } from "./schema.js";

// TODO: Phase 5 -- add JWT auth middleware

/**
 * GET /airplay-events/:id/snippet - Get a presigned URL for the event's audio snippet.
 *
 * Returns a fresh presigned URL valid for 24 hours (86400 seconds).
 * Returns 404 if the event doesn't exist or has no snippet.
 */
export async function getSnippetUrl(
  request: FastifyRequest<{ Params: AirplayEventParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params;

  const event = await prisma.airplayEvent.findUnique({
    where: { id },
  });

  if (!event) {
    return reply.status(404).send({ error: "Airplay event not found" });
  }

  if (!event.snippetUrl) {
    return reply
      .status(404)
      .send({ error: "No snippet available for this event" });
  }

  const presignedUrl = await getPresignedUrl(event.snippetUrl, 86400);

  return reply.send({ url: presignedUrl, expiresIn: 86400 });
}
