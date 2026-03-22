import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "../../../middleware/authenticate.js";
import { ChartAlertQuerySchema, MarkReadSchema } from "./schema.js";
import { listChartAlerts, markAlertsRead } from "./handlers.js";

const chartAlertRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", { schema: { querystring: ChartAlertQuerySchema } }, listChartAlerts);
  fastify.post("/mark-read", { schema: { body: MarkReadSchema } }, markAlertsRead);
};

export default chartAlertRoutes;
