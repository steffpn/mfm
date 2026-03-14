import "dotenv/config";
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

export const createRedisConnection = () =>
  new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  });
