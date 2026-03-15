import type { FastifyPluginAsync } from "fastify";
import { AirplayEventParamsSchema } from "./schema.js";
import { getSnippetUrl } from "./handlers.js";

const airplayEventRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /:id/snippet - Get presigned URL for audio snippet
  fastify.get(
    "/:id/snippet",
    {
      schema: {
        params: AirplayEventParamsSchema,
      },
    },
    getSnippetUrl,
  );
};

export default airplayEventRoutes;
