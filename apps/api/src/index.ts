import Fastify from "fastify";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";

const server = Fastify({ logger: true });

// Health check -- verifies DB and Redis connections
server.get("/health", async () => {
  const dbOk = await prisma
    .$queryRaw`SELECT 1 as ok`
    .then(() => true)
    .catch(() => false);
  const redisOk = await redis
    .ping()
    .then((r) => r === "PONG")
    .catch(() => false);
  return {
    status: dbOk && redisOk ? "ok" : "degraded",
    db: dbOk ? "connected" : "disconnected",
    redis: redisOk ? "connected" : "disconnected",
  };
});

// Graceful shutdown
const shutdown = async () => {
  await prisma.$disconnect();
  redis.disconnect();
  await server.close();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// API v1 routes will be registered as plugins in later phases
// server.register(import("./routes/v1/index.js"), { prefix: "/api/v1" });

export { server };

const start = async () => {
  try {
    await server.listen({ port: 3000, host: "0.0.0.0" });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Only start if this is the main module (not imported by tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
