import type { FastifyPluginAsync } from "fastify";
import { handleStripeWebhook } from "./handlers.js";

const stripeWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  // Stripe webhooks need raw body for signature verification
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_req, body, done) => {
      done(null, body);
    },
  );

  fastify.post("/", handleStripeWebhook);
};

export default stripeWebhookRoutes;
