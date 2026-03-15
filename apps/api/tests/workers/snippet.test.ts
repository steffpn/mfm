import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { EventEmitter } from "node:events";

// ---- Prisma mock ----
const mockAirplayEventUpdate = vi.fn().mockResolvedValue({});

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    airplayEvent: {
      update: (...args: unknown[]) => mockAirplayEventUpdate(...args),
    },
  },
}));

// ---- Segment resolver mock ----
const mockResolveSegments = vi.fn();

vi.mock("../../src/lib/segment-resolver.js", () => ({
  resolveSegments: (...args: unknown[]) => mockResolveSegments(...args),
}));

// ---- R2 mock ----
const mockUploadToR2 = vi.fn().mockResolvedValue(undefined);

vi.mock("../../src/lib/r2.js", () => ({
  uploadToR2: (...args: unknown[]) => mockUploadToR2(...args),
}));

// ---- BullMQ mock ----
const mockWorkerOn = vi.fn();
const mockWorkerClose = vi.fn().mockResolvedValue(undefined);
const mockQueueClose = vi.fn().mockResolvedValue(undefined);

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    close: (...args: unknown[]) => mockQueueClose(...args),
  })),
  Worker: vi.fn().mockImplementation(
    (
      _name: string,
      _processor: (job: unknown) => Promise<void>,
      _opts?: unknown,
    ) => ({
      on: (...args: unknown[]) => mockWorkerOn(...args),
      close: (...args: unknown[]) => mockWorkerClose(...args),
    }),
  ),
}));

// ---- Redis mock ----
vi.mock("../../src/lib/redis.js", () => ({
  createRedisConnection: vi.fn().mockReturnValue({}),
}));

// ---- Pino logger mock ----
const mockLoggerInfo = vi.fn();
const mockLoggerDebug = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("pino", () => ({
  default: () => ({
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    debug: (...args: unknown[]) => mockLoggerDebug(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
    child: vi.fn().mockReturnThis(),
  }),
}));

// ---- child_process mock ----
interface MockProcess extends EventEmitter {
  stderr: EventEmitter | null;
}

let mockSpawnResult: {
  proc: MockProcess;
  exitCode: number;
  error?: Error;
};

const mockSpawn = vi.fn().mockImplementation(() => {
  const { EventEmitter } = require("node:events");
  const proc = new EventEmitter() as MockProcess;
  const stderr = new EventEmitter();
  proc.stderr = stderr;

  // Store for later triggering
  mockSpawnResult.proc = proc;

  // Simulate FFmpeg completing (success or failure)
  process.nextTick(() => {
    if (mockSpawnResult.error) {
      proc.emit("error", mockSpawnResult.error);
    } else {
      proc.emit("close", mockSpawnResult.exitCode);
    }
  });

  return proc;
});

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

// ---- fs mock ----
const mockReadFile = vi.fn().mockResolvedValue(Buffer.from("fake-aac-data"));
const mockUnlink = vi.fn().mockResolvedValue(undefined);

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: (...args: unknown[]) => mockReadFile(...args),
    unlink: (...args: unknown[]) => mockUnlink(...args),
  },
  readFile: (...args: unknown[]) => mockReadFile(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
}));

// ---- Test Data ----
const MOCK_JOB_DATA = {
  airplayEventId: 42,
  stationId: 1,
  detectedAt: "2026-03-15T14:30:05.000Z",
};

const MOCK_SEGMENTS = {
  segments: [
    "/mock/data/streams/1/segment-000.ts",
    "/mock/data/streams/1/segment-001.ts",
  ],
  seekOffsetSeconds: 2.5,
};

describe("Snippet Worker", () => {
  let processSnippetJob: typeof import("../../src/workers/snippet.js").processSnippetJob;
  let startSnippetWorker: typeof import("../../src/workers/snippet.js").startSnippetWorker;
  let SNIPPET_QUEUE: string;

  const originalEnv = process.env.SNIPPETS_ENABLED;

  beforeEach(async () => {
    // Reset all mocks
    mockResolveSegments.mockReset();
    mockUploadToR2.mockReset().mockResolvedValue(undefined);
    mockAirplayEventUpdate.mockReset().mockResolvedValue({});
    mockReadFile.mockReset().mockResolvedValue(Buffer.from("fake-aac-data"));
    mockUnlink.mockReset().mockResolvedValue(undefined);
    mockSpawn.mockClear();
    mockLoggerInfo.mockClear();
    mockLoggerDebug.mockClear();
    mockLoggerWarn.mockClear();
    mockLoggerError.mockClear();
    mockWorkerOn.mockClear();

    // Default: snippets enabled, segments available, FFmpeg succeeds
    process.env.SNIPPETS_ENABLED = "true";
    mockResolveSegments.mockResolvedValue(MOCK_SEGMENTS);
    mockSpawnResult = { proc: null as unknown as MockProcess, exitCode: 0 };

    const mod = await import("../../src/workers/snippet.js");
    processSnippetJob = mod.processSnippetJob;
    startSnippetWorker = mod.startSnippetWorker;
    SNIPPET_QUEUE = mod.SNIPPET_QUEUE;
  });

  afterEach(() => {
    process.env.SNIPPETS_ENABLED = originalEnv;
  });

  // ============================================
  // Happy path
  // ============================================
  describe("Happy path", () => {
    it("extracts 5s clip via FFmpeg, uploads to R2, updates AirplayEvent.snippetUrl with R2 key", async () => {
      await processSnippetJob(MOCK_JOB_DATA);

      // FFmpeg was spawned
      expect(mockSpawn).toHaveBeenCalledTimes(1);

      // R2 upload was called
      expect(mockUploadToR2).toHaveBeenCalledWith(
        "snippets/1/2026-03-15/42.aac",
        Buffer.from("fake-aac-data"),
        "audio/aac",
      );

      // DB was updated
      expect(mockAirplayEventUpdate).toHaveBeenCalledWith({
        where: { id: 42 },
        data: { snippetUrl: "snippets/1/2026-03-15/42.aac" },
      });
    });

    it("R2 key follows pattern: snippets/{stationId}/{YYYY-MM-DD}/{airplayEventId}.aac", async () => {
      await processSnippetJob({
        airplayEventId: 789,
        stationId: 42,
        detectedAt: "2026-06-20T08:15:30.000Z",
      });

      expect(mockUploadToR2).toHaveBeenCalledWith(
        "snippets/42/2026-06-20/789.aac",
        expect.any(Buffer),
        "audio/aac",
      );
    });
  });

  // ============================================
  // Kill switch
  // ============================================
  describe("Kill switch", () => {
    it("skips extraction when SNIPPETS_ENABLED is not 'true'", async () => {
      process.env.SNIPPETS_ENABLED = "false";

      await processSnippetJob(MOCK_JOB_DATA);

      expect(mockSpawn).not.toHaveBeenCalled();
      expect(mockUploadToR2).not.toHaveBeenCalled();
      expect(mockAirplayEventUpdate).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Missing segments
  // ============================================
  describe("Missing segments", () => {
    it("skips extraction when resolveSegments returns null", async () => {
      mockResolveSegments.mockResolvedValue(null);

      await processSnippetJob(MOCK_JOB_DATA);

      expect(mockSpawn).not.toHaveBeenCalled();
      expect(mockUploadToR2).not.toHaveBeenCalled();
      expect(mockAirplayEventUpdate).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Temp file cleanup
  // ============================================
  describe("Temp file cleanup", () => {
    it("cleans up temporary file after successful upload", async () => {
      await processSnippetJob(MOCK_JOB_DATA);

      expect(mockUnlink).toHaveBeenCalledTimes(1);
      expect(mockUnlink).toHaveBeenCalledWith(
        expect.stringContaining("snippet-42-"),
      );
    });

    it("cleans up temporary file after failed FFmpeg extraction", async () => {
      mockSpawnResult = {
        proc: null as unknown as MockProcess,
        exitCode: 1,
      };

      await expect(processSnippetJob(MOCK_JOB_DATA)).rejects.toThrow();

      expect(mockUnlink).toHaveBeenCalledTimes(1);
    });

    it("cleans up temporary file after failed R2 upload", async () => {
      mockUploadToR2.mockRejectedValue(new Error("R2 upload failed"));

      await expect(processSnippetJob(MOCK_JOB_DATA)).rejects.toThrow(
        "R2 upload failed",
      );

      expect(mockUnlink).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // FFmpeg arguments
  // ============================================
  describe("FFmpeg arguments", () => {
    it("spawns FFmpeg with correct args", async () => {
      await processSnippetJob(MOCK_JOB_DATA);

      expect(mockSpawn).toHaveBeenCalledWith(
        "ffmpeg",
        expect.arrayContaining([
          "-ss",
          "2.5",
          "-i",
          "concat:/mock/data/streams/1/segment-000.ts|/mock/data/streams/1/segment-001.ts",
          "-t",
          "5",
          "-vn",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-ar",
          "44100",
          "-ac",
          "2",
          "-f",
          "adts",
        ]),
        expect.any(Object),
      );
    });
  });

  // ============================================
  // Worker lifecycle
  // ============================================
  describe("Worker lifecycle", () => {
    it("startSnippetWorker returns { queue, worker }", async () => {
      const result = await startSnippetWorker();

      expect(result).toHaveProperty("queue");
      expect(result).toHaveProperty("worker");
    });

    it("Worker concurrency is 2", async () => {
      const { Worker } = await import("bullmq");

      await startSnippetWorker();

      expect(Worker).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({ concurrency: 2 }),
      );
    });

    it("Worker uses SNIPPET_QUEUE constant for queue name", async () => {
      const { Worker, Queue } = await import("bullmq");

      await startSnippetWorker();

      expect(Queue).toHaveBeenCalledWith(
        SNIPPET_QUEUE,
        expect.any(Object),
      );
      expect(Worker).toHaveBeenCalledWith(
        SNIPPET_QUEUE,
        expect.any(Function),
        expect.any(Object),
      );
    });

    it("worker registers 'failed' event handler", async () => {
      await startSnippetWorker();

      expect(mockWorkerOn).toHaveBeenCalledWith(
        "failed",
        expect.any(Function),
      );
    });
  });
});
