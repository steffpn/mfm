import type { FastifyPluginAsync } from "fastify";

const configRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /config — public endpoint, returns app configuration
  fastify.get("/", async (_request, reply) => {
    return reply.send({
      demoMode: process.env.DEMO_MODE === "true",
      demoAccounts: process.env.DEMO_MODE === "true"
        ? [
            { label: "Admin", email: "admin@mfm.test", role: "ADMIN", tier: null },
            { label: "Artist Free", email: "artist-free@mfm.test", role: "ARTIST", tier: "FREE" },
            { label: "Artist Premium", email: "artist-premium@mfm.test", role: "ARTIST", tier: "PREMIUM" },
            { label: "Label Free", email: "label-free@mfm.test", role: "LABEL", tier: "FREE" },
            { label: "Label Premium", email: "label-premium@mfm.test", role: "LABEL", tier: "PREMIUM" },
            { label: "Station Free", email: "station-free@mfm.test", role: "STATION", tier: "FREE" },
            { label: "Station Premium", email: "station-premium@mfm.test", role: "STATION", tier: "PREMIUM" },
          ]
        : [],
      demoPassword: process.env.DEMO_MODE === "true" ? "test1234" : null,
    });
  });
};

export default configRoutes;
