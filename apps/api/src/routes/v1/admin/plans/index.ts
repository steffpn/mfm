import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "../../../../middleware/authenticate.js";
import { requireRole } from "../../../../middleware/authorize.js";
import {
  PlanParamsSchema,
  PlanBodySchema,
  PlanFeatureParamsSchema,
  AssignFeatureBodySchema,
} from "./schema.js";
import {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  assignFeature,
  removeFeature,
  getMatrix,
} from "./handlers.js";

const adminPlanRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes in this plugin require admin auth
  fastify.addHook("preHandler", authenticate);
  fastify.addHook("preHandler", requireRole("ADMIN"));

  // GET /matrix - Feature matrix (must be before /:id to avoid conflict)
  fastify.get("/matrix", getMatrix);

  // GET / - List all plans
  fastify.get("/", listPlans);

  // POST / - Create a plan
  fastify.post(
    "/",
    {
      schema: {
        body: PlanBodySchema,
      },
    },
    createPlan,
  );

  // PATCH /:id - Update a plan
  fastify.patch(
    "/:id",
    {
      schema: {
        params: PlanParamsSchema,
      },
    },
    updatePlan,
  );

  // DELETE /:id - Soft-delete a plan
  fastify.delete(
    "/:id",
    {
      schema: {
        params: PlanParamsSchema,
      },
    },
    deletePlan,
  );

  // POST /:id/features - Assign a feature to a plan
  fastify.post(
    "/:id/features",
    {
      schema: {
        params: PlanParamsSchema,
        body: AssignFeatureBodySchema,
      },
    },
    assignFeature,
  );

  // DELETE /:id/features/:featureId - Remove a feature from a plan
  fastify.delete(
    "/:id/features/:featureId",
    {
      schema: {
        params: PlanFeatureParamsSchema,
      },
    },
    removeFeature,
  );
};

export default adminPlanRoutes;
