/**
 * BullMQ cleanup worker for stale segment files.
 *
 * Runs on a 30-second schedule via BullMQ job scheduler. Scans all station
 * directories in data/streams/ and deletes segment files with mtime older
 * than 3 minutes. Also removes orphaned directories from deleted/inactive
 * stations.
 *
 * Acts as a safety net alongside FFmpeg's segment_wrap.
 */

import { Worker, Queue } from "bullmq";
import { createRedisConnection } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import fs from "node:fs/promises";
import path from "node:path";
import pino from "pino";

const logger = pino({ name: "cleanup-worker" });

const CLEANUP_QUEUE = "segment-cleanup";
const DATA_DIR = path.resolve("./data/streams");
const MAX_AGE_MS = 3 * 60 * 1000; // 3 minutes per user decision
const NO_MATCH_MAX_AGE_DAYS = 7;

/**
 * Core cleanup logic -- exported for direct testing.
 *
 * Scans all subdirectories in DATA_DIR:
 * 1. Deletes segment files older than MAX_AGE_MS
 * 2. After file cleanup, re-checks directory emptiness
 * 3. Removes empty directories if the station is not ACTIVE in DB
 */
export async function cleanupSegments(): Promise<void> {
  let stationDirs: Array<{ name: string; isDirectory: () => boolean }>;

  try {
    stationDirs = await fs.readdir(DATA_DIR, { withFileTypes: true });
  } catch {
    // DATA_DIR doesn't exist yet -- nothing to clean
    logger.debug("DATA_DIR does not exist, skipping cleanup");
    return;
  }

  for (const dir of stationDirs) {
    if (!dir.isDirectory()) continue;

    const stationDir = path.join(DATA_DIR, dir.name);
    const stationId = parseInt(dir.name, 10);

    try {
      // Read files in station directory
      const files = await fs.readdir(stationDir);

      // Delete stale segment files
      for (const file of files) {
        const filePath = path.join(stationDir, file);
        try {
          const stat = await fs.stat(filePath);
          if (Date.now() - stat.mtimeMs > MAX_AGE_MS) {
            await fs.unlink(filePath);
            logger.debug({ stationId, file }, "Deleted stale segment");
          }
        } catch (err) {
          // Permission error or race condition -- log and continue
          logger.warn(
            { stationId, file, err },
            "Failed to process segment file",
          );
        }
      }

      // After cleanup, re-read directory to check if empty
      const remainingFiles = await fs.readdir(stationDir);

      if (remainingFiles.length === 0) {
        // Check if station is active in DB -- don't remove if it just started
        const activeStation = Number.isNaN(stationId)
          ? null
          : await prisma.station.findFirst({
              where: { id: stationId, status: "ACTIVE" },
            });

        if (!activeStation) {
          await fs.rmdir(stationDir);
          logger.info({ stationId: dir.name }, "Removed orphaned directory");
        }
      }
    } catch (err) {
      // Errors reading the directory itself -- log and continue to next
      logger.warn({ stationId: dir.name, err }, "Failed to process station directory");
    }
  }
}

/**
 * Clean up old no-match callback records.
 *
 * Deletes NoMatchCallback records older than NO_MATCH_MAX_AGE_DAYS (7 days).
 * Runs on a 6-hour schedule via the same BullMQ cleanup queue.
 */
export async function cleanupNoMatchCallbacks(): Promise<void> {
  const cutoff = new Date(
    Date.now() - NO_MATCH_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  );
  const result = await prisma.noMatchCallback.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  if (result.count > 0) {
    logger.info({ deleted: result.count }, "Cleaned up old no-match callbacks");
  }
}

/**
 * Start the cleanup worker with BullMQ job scheduler.
 *
 * Registers a scheduler that runs every 30 seconds and creates a worker
 * that processes cleanup jobs by calling cleanupSegments().
 *
 * @returns Object with queue and worker references for graceful shutdown
 */
export async function startCleanupWorker(): Promise<{
  queue: Queue;
  worker: Worker;
}> {
  const queue = new Queue(CLEANUP_QUEUE, {
    connection: createRedisConnection(),
  });

  // BullMQ v5.16+ job scheduler API (replaces deprecated repeatable jobs)
  await queue.upsertJobScheduler(
    "cleanup-scheduler",
    { every: 30_000 },
    { name: "cleanup-segments", data: {} },
  );

  // No-match callback cleanup: every 6 hours
  await queue.upsertJobScheduler(
    "no-match-cleanup-scheduler",
    { every: 6 * 60 * 60 * 1000 },
    { name: "cleanup-no-match", data: {} },
  );

  const worker = new Worker(
    CLEANUP_QUEUE,
    async (job) => {
      if (job.name === "cleanup-no-match") {
        logger.debug("Running no-match callback cleanup");
        await cleanupNoMatchCallbacks();
        logger.debug("No-match callback cleanup complete");
      } else {
        logger.debug("Running segment cleanup");
        await cleanupSegments();
        logger.debug("Segment cleanup complete");
      }
    },
    { connection: createRedisConnection() },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Cleanup job failed");
  });

  logger.info("Cleanup worker started (30s schedule)");

  return { queue, worker };
}
