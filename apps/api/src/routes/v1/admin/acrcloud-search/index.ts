import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "../../../../middleware/authenticate.js";
import { requireRole } from "../../../../middleware/authorize.js";
import { AcrcloudSearchQuerySchema } from "./schema.js";
import { searchAcrcloud } from "./handlers.js";

const adminAcrcloudSearchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticate);
  fastify.addHook("preHandler", requireRole("ADMIN"));

  // GET / - Search ACRCloud music database
  fastify.get(
    "/",
    { schema: { querystring: AcrcloudSearchQuerySchema } },
    searchAcrcloud,
  );
};

export default adminAcrcloudSearchRoutes;
