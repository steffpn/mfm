import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "../../../../middleware/authenticate.js";
import { requireRole } from "../../../../middleware/authorize.js";
import { CreateInvitationSchema, InvitationParamsSchema } from "./schema.js";
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
} from "./handlers.js";

const adminInvitationRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes in this plugin require admin auth
  fastify.addHook("preHandler", authenticate);
  fastify.addHook("preHandler", requireRole("ADMIN"));

  // POST / - Create a new invitation
  fastify.post(
    "/",
    {
      schema: {
        body: CreateInvitationSchema,
      },
    },
    createInvitation,
  );

  // GET / - List all invitations
  fastify.get("/", listInvitations);

  // PATCH /:id/revoke - Revoke an invitation
  fastify.patch(
    "/:id/revoke",
    {
      schema: {
        params: InvitationParamsSchema,
      },
    },
    revokeInvitation,
  );
};

export default adminInvitationRoutes;
