import type { FastifyPluginAsync } from "fastify";

const v1Routes: FastifyPluginAsync = async (fastify) => {
  fastify.register(import("./stations/index.js"), { prefix: "/stations" });
};

export default v1Routes;
