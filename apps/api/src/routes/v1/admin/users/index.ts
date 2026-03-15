import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "../../../../middleware/authenticate.js";
import { requireRole } from "../../../../middleware/authorize.js";
import {
  UserParamsSchema,
  UpdateRoleSchema,
  UpdateScopesSchema,
} from "./schema.js";
import {
  listUsers,
  deactivateUser,
  reactivateUser,
  updateUserRole,
  updateUserScopes,
} from "./handlers.js";

const adminUserRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes in this plugin require admin auth
  fastify.addHook("preHandler", authenticate);
  fastify.addHook("preHandler", requireRole("ADMIN"));

  // GET / - List all users
  fastify.get("/", listUsers);

  // PATCH /:id/deactivate - Deactivate a user
  fastify.patch(
    "/:id/deactivate",
    {
      schema: {
        params: UserParamsSchema,
      },
    },
    deactivateUser,
  );

  // PATCH /:id/reactivate - Reactivate a user
  fastify.patch(
    "/:id/reactivate",
    {
      schema: {
        params: UserParamsSchema,
      },
    },
    reactivateUser,
  );

  // PATCH /:id/role - Update user role
  fastify.patch(
    "/:id/role",
    {
      schema: {
        params: UserParamsSchema,
        body: UpdateRoleSchema,
      },
    },
    updateUserRole,
  );

  // PUT /:id/scopes - Replace user scopes
  fastify.put(
    "/:id/scopes",
    {
      schema: {
        params: UserParamsSchema,
        body: UpdateScopesSchema,
      },
    },
    updateUserScopes,
  );
};

export default adminUserRoutes;
