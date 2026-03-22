import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "../../../../middleware/authenticate.js";
import { requireRole } from "../../../../middleware/authorize.js";
import { FeatureParamsSchema, FeatureBodySchema } from "./schema.js";
import {
  listFeatures,
  createFeature,
  updateFeature,
  deleteFeature,
} from "./handlers.js";

const adminFeatureRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes in this plugin require admin auth
  fastify.addHook("preHandler", authenticate);
  fastify.addHook("preHandler", requireRole("ADMIN"));

  // GET / - List all features
  fastify.get("/", listFeatures);

  // POST / - Create a feature
  fastify.post(
    "/",
    {
      schema: {
        body: FeatureBodySchema,
      },
    },
    createFeature,
  );

  // PATCH /:id - Update a feature
  fastify.patch(
    "/:id",
    {
      schema: {
        params: FeatureParamsSchema,
      },
    },
    updateFeature,
  );

  // DELETE /:id - Delete a feature
  fastify.delete(
    "/:id",
    {
      schema: {
        params: FeatureParamsSchema,
      },
    },
    deleteFeature,
  );
};

export default adminFeatureRoutes;
