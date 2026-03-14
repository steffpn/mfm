import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from "vitest";
import { server } from "../../src/index.js";

/**
 * ACRCloud Webhook Route Tests
 *
 * Tests auth (shared secret), TypeBox schema validation,
 * BullMQ enqueue behavior, and response format.
 *
 * BullMQ Queue.add is mocked to avoid requiring Redis for tests.
 */

// Mock BullMQ so we can intercept queue.add calls without Redis
const mockQueueAdd = vi.fn().mockResolvedValue({ id: "mock-job-id" });
const mockQueueClose = vi.fn().mockResolvedValue(undefined);

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: mockQueueClose,
  })),
}));

const VALID_SECRET = "test-webhook-secret";

// Valid ACRCloud callback payload (success, code 0)
function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    stream_id: "s-abc123",
    stream_url: "http://example.com/stream",
    status: 1,
    data: {
      status: { msg: "Success", code: 0, version: "1.0" },
      result_type: 0,
      metadata: {
        timestamp_utc: "2026-03-15 14:30:00",
        played_duration: 173,
        music: [
          {
            title: "Doua Inimi",
            artists: [{ name: "Irina Rimes" }],
            album: { name: "Despre El" },
            duration_ms: 186506,
            score: 100.0,
            acrid: "abc123def456",
            external_ids: { isrc: "ROA231600001" },
          },
        ],
      },
    },
    ...overrides,
  };
}

describe("ACRCloud Webhook Route", () => {
  beforeAll(async () => {
    process.env.ACRCLOUD_WEBHOOK_SECRET = VALID_SECRET;
    await server.ready();
  });

  beforeEach(() => {
    mockQueueAdd.mockClear();
  });

  afterAll(async () => {
    delete process.env.ACRCLOUD_WEBHOOK_SECRET;
    await server.close();
  });

  // --- Auth Tests ---

  describe("Authentication", () => {
    it("accepts valid X-ACR-Secret header and enqueues callback", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/webhooks/acrcloud",
        headers: { "x-acr-secret": VALID_SECRET },
        payload: validPayload(),
      });

      expect(response.statusCode).toBe(200);
      expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    });

    it("returns 200 but does NOT enqueue when secret is invalid (silent drop)", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/webhooks/acrcloud",
        headers: { "x-acr-secret": "wrong-secret" },
        payload: validPayload(),
      });

      expect(response.statusCode).toBe(200);
      expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it("returns 200 but does NOT enqueue when secret header is missing (silent drop)", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/webhooks/acrcloud",
        payload: validPayload(),
      });

      expect(response.statusCode).toBe(200);
      expect(mockQueueAdd).not.toHaveBeenCalled();
    });
  });

  // --- Validation Tests ---

  describe("Schema Validation", () => {
    it("accepts valid body matching AcrCloudCallbackSchema", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/webhooks/acrcloud",
        headers: { "x-acr-secret": VALID_SECRET },
        payload: validPayload(),
      });

      expect(response.statusCode).toBe(200);
    });

    it("rejects payload with missing stream_id with 400", async () => {
      const { stream_id, ...payloadWithoutStreamId } = validPayload();

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/webhooks/acrcloud",
        headers: { "x-acr-secret": VALID_SECRET },
        payload: payloadWithoutStreamId,
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects payload with missing data object with 400", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/webhooks/acrcloud",
        headers: { "x-acr-secret": VALID_SECRET },
        payload: {
          stream_id: "s-abc123",
          status: 1,
          // missing data
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects empty body with 400", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/webhooks/acrcloud",
        headers: { "x-acr-secret": VALID_SECRET },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // --- Enqueue Tests ---

  describe("BullMQ Enqueue", () => {
    it("enqueues valid callback with job name 'process-callback'", async () => {
      const payload = validPayload();

      await server.inject({
        method: "POST",
        url: "/api/v1/webhooks/acrcloud",
        headers: { "x-acr-secret": VALID_SECRET },
        payload,
      });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        "process-callback",
        expect.objectContaining({ stream_id: "s-abc123" }),
        expect.any(Object),
      );
    });

    it("enqueues raw callback payload without transformation", async () => {
      const payload = validPayload();

      await server.inject({
        method: "POST",
        url: "/api/v1/webhooks/acrcloud",
        headers: { "x-acr-secret": VALID_SECRET },
        payload,
      });

      const enqueued = mockQueueAdd.mock.calls[0][1];
      expect(enqueued.stream_id).toBe("s-abc123");
      expect(enqueued.data.status.code).toBe(0);
      expect(enqueued.data.metadata.music[0].title).toBe("Doua Inimi");
    });

    it("includes removeOnComplete: 1000 and removeOnFail: 5000 in job options", async () => {
      await server.inject({
        method: "POST",
        url: "/api/v1/webhooks/acrcloud",
        headers: { "x-acr-secret": VALID_SECRET },
        payload: validPayload(),
      });

      const jobOpts = mockQueueAdd.mock.calls[0][2];
      expect(jobOpts.removeOnComplete).toBe(1000);
      expect(jobOpts.removeOnFail).toBe(5000);
    });
  });

  // --- Response Tests ---

  describe("Response Format", () => {
    it("returns { status: 'ok' } for valid request", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/webhooks/acrcloud",
        headers: { "x-acr-secret": VALID_SECRET },
        payload: validPayload(),
      });

      const body = JSON.parse(response.payload);
      expect(body).toEqual({ status: "ok" });
    });

    it("returns { status: 'ok' } for invalid auth (no information leak)", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/webhooks/acrcloud",
        headers: { "x-acr-secret": "wrong-secret" },
        payload: validPayload(),
      });

      const body = JSON.parse(response.payload);
      expect(body).toEqual({ status: "ok" });
    });
  });
});
