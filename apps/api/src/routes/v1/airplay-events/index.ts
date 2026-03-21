import type { FastifyPluginAsync } from "fastify";
import { AirplayEventParamsSchema, ListEventsQuerySchema } from "./schema.js";
import { SongHistoryQuerySchema } from "./history-schema.js";
import { getSnippetUrl, listEvents } from "./handlers.js";
import { getSongHistory } from "./history-handlers.js";
import { authenticate } from "../../../middleware/authenticate.js";

const airplayEventRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /history - Song detection timeline across all stations
  fastify.get(
    "/history",
    {
      preHandler: [authenticate],
      schema: {
        querystring: SongHistoryQuerySchema,
      },
    },
    getSongHistory,
  );

  // GET / - List airplay events with search, filters, cursor pagination (requires auth)
  fastify.get(
    "/",
    {
      preHandler: [authenticate],
      schema: {
        querystring: ListEventsQuerySchema,
      },
    },
    listEvents,
  );

  // GET /:id/snippet - Get presigned URL for audio snippet (requires auth)
  fastify.get(
    "/:id/snippet",
    {
      preHandler: [authenticate],
      schema: {
        params: AirplayEventParamsSchema,
      },
    },
    getSnippetUrl,
  );
};

export default airplayEventRoutes;
