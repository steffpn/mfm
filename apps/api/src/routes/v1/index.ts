import type { FastifyPluginAsync } from "fastify";

const v1Routes: FastifyPluginAsync = async (fastify) => {
  fastify.register(import("./auth/index.js"), { prefix: "/auth" });
  fastify.register(import("./stations/index.js"), { prefix: "/stations" });
  fastify.register(import("./webhooks/acrcloud/index.js"), {
    prefix: "/webhooks/acrcloud",
  });
  fastify.register(import("./airplay-events/index.js"), {
    prefix: "/airplay-events",
  });
  fastify.register(import("./admin/invitations/index.js"), {
    prefix: "/admin/invitations",
  });
  fastify.register(import("./admin/users/index.js"), {
    prefix: "/admin/users",
  });
  fastify.register(import("./dashboard/index.js"), {
    prefix: "/dashboard",
  });
};

export default v1Routes;
