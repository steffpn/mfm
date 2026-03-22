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
  fastify.register(import("./live-feed/index.js"), {
    prefix: "/live-feed",
  });
  fastify.register(import("./exports/index.js"), {
    prefix: "/exports",
  });
  fastify.register(import("./notifications/index.js"), {
    prefix: "/notifications",
  });
  fastify.register(import("./competitors/index.js"), {
    prefix: "/competitors",
  });
  fastify.register(import("./station/index.js"), {
    prefix: "/station",
  });
  fastify.register(import("./artist/index.js"), {
    prefix: "/artist",
  });
  fastify.register(import("./admin/missing-songs/index.js"), {
    prefix: "/admin/missing-songs",
  });
  fastify.register(import("./admin/acrcloud-search/index.js"), {
    prefix: "/admin/acrcloud-search",
  });
  fastify.register(import("./label/index.js"), {
    prefix: "/label",
  });
  fastify.register(import("./admin/features/index.js"), {
    prefix: "/admin/features",
  });
  fastify.register(import("./admin/plans/index.js"), {
    prefix: "/admin/plans",
  });
  fastify.register(import("./admin/subscriptions/index.js"), {
    prefix: "/admin/subscriptions",
  });
  fastify.register(import("./webhooks/stripe/index.js"), {
    prefix: "/webhooks/stripe",
  });
  fastify.register(import("./reports/index.js"), {
    prefix: "/reports",
  });
  fastify.register(import("./settings/index.js"), {
    prefix: "/settings",
  });
  fastify.register(import("./curation/index.js"), {
    prefix: "/curation",
  });
  fastify.register(import("./chart-alerts/index.js"), {
    prefix: "/chart-alerts",
  });
};

export default v1Routes;
