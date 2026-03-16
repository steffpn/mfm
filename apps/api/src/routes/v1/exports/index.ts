import type { FastifyPluginAsync } from "fastify";
import { ExportCSVQuerySchema, ExportPDFQuerySchema } from "./schema.js";
import { exportCSV, exportPDF } from "./handlers.js";
import { authenticate } from "../../../middleware/authenticate.js";

const exportRoutes: FastifyPluginAsync = async (fastify) => {
  // All export routes require authentication
  fastify.addHook("preHandler", authenticate);

  // GET /csv - Export filtered airplay events as CSV
  fastify.get(
    "/csv",
    {
      schema: {
        querystring: ExportCSVQuerySchema,
      },
    },
    exportCSV,
  );

  // GET /pdf - Export filtered airplay events as branded PDF report
  fastify.get(
    "/pdf",
    {
      schema: {
        querystring: ExportPDFQuerySchema,
      },
    },
    exportPDF,
  );
};

export default exportRoutes;
