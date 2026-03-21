import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "../../../../middleware/authenticate.js";
import { requireRole } from "../../../../middleware/authorize.js";
import {
  CreateMissingSongSchema,
  UpdateMissingSongSchema,
  MissingSongParamsSchema,
  ListMissingSongsQuerySchema,
} from "./schema.js";
import { createReport, listReports, updateReport } from "./handlers.js";

const adminMissingSongRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticate);
  fastify.addHook("preHandler", requireRole("ADMIN"));

  // POST / - Report a missing song
  fastify.post(
    "/",
    { schema: { body: CreateMissingSongSchema } },
    createReport,
  );

  // GET / - List all reports
  fastify.get(
    "/",
    { schema: { querystring: ListMissingSongsQuerySchema } },
    listReports,
  );

  // PATCH /:id - Update report status
  fastify.patch(
    "/:id",
    {
      schema: {
        params: MissingSongParamsSchema,
        body: UpdateMissingSongSchema,
      },
    },
    updateReport,
  );
};

export default adminMissingSongRoutes;
