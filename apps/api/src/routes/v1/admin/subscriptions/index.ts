import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "../../../../middleware/authenticate.js";
import { requireRole } from "../../../../middleware/authorize.js";
import {
  CreateCheckoutSchema,
  CustomerPortalSchema,
} from "./schema.js";
import {
  listSubscriptions,
  createCheckout,
  createPortalSession,
  mySubscription,
} from "./handlers.js";

const subscriptionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticate);

  // Any authenticated user can access their own subscription
  fastify.get("/me", mySubscription);

  // Any authenticated user can create a checkout session
  fastify.post(
    "/checkout",
    { schema: { body: CreateCheckoutSchema } },
    createCheckout,
  );

  // Any authenticated user can access their billing portal
  fastify.post(
    "/portal",
    { schema: { body: CustomerPortalSchema } },
    createPortalSession,
  );

  // Admin-only: list all subscriptions
  fastify.get(
    "/",
    { preHandler: requireRole("ADMIN") },
    listSubscriptions,
  );
};

export default subscriptionRoutes;
