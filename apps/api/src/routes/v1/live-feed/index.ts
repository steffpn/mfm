/**
 * SSE live-feed route plugin.
 *
 * GET /v1/live-feed?token=xxx
 *
 * Authenticates via JWT query parameter, subscribes to Redis pub/sub
 * for detection events, filters by user role/scope, and streams them
 * as Server-Sent Events. Supports Last-Event-ID backfill replay.
 */

import type { FastifyPluginAsync } from "fastify";
import fastifySSE from "@fastify/sse";
import { prisma } from "../../../lib/prisma.js";
import { redis, createRedisConnection } from "../../../lib/redis.js";
import {
  CHANNELS,
  BACKFILL_KEY,
  type LiveDetectionEvent,
} from "../../../lib/pubsub.js";
import { shouldDeliverToUser } from "../../../lib/live-feed-filter.js";
import type { CurrentUser } from "../../../middleware/authenticate.js";
import type { LiveFeedQuery } from "./schema.js";

const liveFeedRoutes: FastifyPluginAsync = async (fastify) => {
  // Register SSE plugin on this route scope
  await fastify.register(fastifySSE, { heartbeatInterval: 15000 });

  fastify.get<{ Querystring: LiveFeedQuery }>(
    "/",
    { sse: true },
    async (request, reply) => {
      // Helper to send error responses within SSE context.
      // When @fastify/sse wraps the handler, raw headers are already set for SSE.
      // We use reply.raw directly to avoid Fastify pipeline conflicts.
      const sendError = (statusCode: number, message: string) => {
        reply.raw.writeHead(statusCode, { "Content-Type": "application/json" });
        reply.raw.end(JSON.stringify({ error: message }));
      };

      const token = request.query?.token;
      if (!token) {
        sendError(401, "Token required");
        return;
      }

      // Verify JWT manually (can't use authenticate middleware for query-param auth)
      let payload: { sub: number };
      try {
        payload = fastify.jwt.verify(token) as { sub: number };
      } catch {
        sendError(401, "Invalid token");
        return;
      }

      // Load user + scopes for filtering
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        include: { scopes: true },
      });

      if (!user || !user.isActive) {
        sendError(401, "Invalid token");
        return;
      }

      // Build CurrentUser object (same shape as authenticate middleware)
      const currentUser: CurrentUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        isPremium: false,
        scopes: user.scopes.map((s) => ({
          entityType: s.entityType,
          entityId: s.entityId,
        })),
      };

      // Handle Last-Event-ID backfill replay
      await reply.sse.replay(async (lastEventId: string) => {
        const lastId = parseInt(lastEventId, 10);
        if (isNaN(lastId)) return;

        const raw = await redis.zrangebyscore(
          BACKFILL_KEY,
          lastId + 1,
          "+inf",
        );

        for (const entry of raw) {
          try {
            const event = JSON.parse(entry) as LiveDetectionEvent;
            if (shouldDeliverToUser(event, currentUser)) {
              await reply.sse.send({
                id: String(event.id),
                event: "detection",
                data: entry,
              });
            }
          } catch {
            // Skip malformed entries
          }
        }
      });

      // Create a dedicated Redis subscriber connection
      const subscriber = createRedisConnection();
      await subscriber.subscribe(CHANNELS.DETECTION_NEW);

      // Stream live events filtered by user role/scope
      subscriber.on("message", async (_channel: string, message: string) => {
        if (!reply.sse.isConnected) return;

        try {
          const event = JSON.parse(message) as LiveDetectionEvent;
          if (shouldDeliverToUser(event, currentUser)) {
            await reply.sse.send({
              id: String(event.id),
              event: "detection",
              data: message,
            });
          }
        } catch {
          // Skip malformed messages
        }
      });

      // Flush SSE headers and keep connection alive
      reply.sse.sendHeaders();
      reply.sse.keepAlive();

      // Clean up Redis subscriber on connection close
      reply.sse.onClose(() => {
        subscriber.unsubscribe().catch(() => {});
        subscriber.disconnect();
      });
    },
  );
};

export default liveFeedRoutes;
