import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "../../../middleware/authenticate.js";
import { ReportQuerySchema } from "./schema.js";
import { listReports, todayReport } from "./handlers.js";

const reportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", { schema: { querystring: ReportQuerySchema } }, listReports);
  fastify.get("/today", todayReport);
};

export default reportRoutes;
