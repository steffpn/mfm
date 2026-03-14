# Phase 3: Detection Pipeline - Research

**Researched:** 2026-03-15
**Domain:** ACRCloud webhook ingestion, real-time deduplication, BullMQ job processing
**Confidence:** HIGH

## Summary

Phase 3 implements the core detection ingestion pipeline: a Fastify webhook endpoint receives ACRCloud broadcast monitoring callbacks, acknowledges immediately, enqueues to BullMQ for async processing, and a worker performs deduplication into airplay events. The project already has substantial infrastructure in place -- Prisma schema with Detection and AirplayEvent models, TimescaleDB hypertable on detections, BullMQ + Redis setup, Fastify route patterns, and shared TypeScript types/constants.

The ACRCloud callback payload is well-documented: a JSON POST with `stream_id`, `stream_url`, `status`, and a `data` object containing `metadata.music[]` array with title, artists, album, ISRC, duration, confidence score, and timestamps. No-result callbacks (code 1001) have the same envelope but empty music array. The deduplication strategy uses ISRC-first matching with title+artist fallback, gap tolerance of 5 minutes (already defined as `DETECTION_GAP_TOLERANCE_MS`), and real-time aggregation per callback.

**Primary recommendation:** Implement as three discrete components: (1) webhook route with TypeBox validation and immediate 200 + BullMQ enqueue, (2) detection worker that processes callbacks into Detection records and upserts AirplayEvent aggregates, (3) no-match table + cleanup scheduler. Use the existing cleanup worker as the template for BullMQ worker lifecycle.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Shared secret header for webhook authentication (X-ACR-Secret or similar)
- Failed auth returns 200 OK + silently drops payload (prevent endpoint confirmation)
- Strict schema validation on callback payload using Fastify+TypeBox
- Immediate 200 acknowledgment -- processing async via BullMQ
- Webhook handler enqueues raw callback to BullMQ, worker processes it
- Real-time aggregation (not periodic batch) for deduplication
- Gap tolerance: 5 minutes (DETECTION_GAP_TOLERANCE_MS = 300000)
- Match key: ISRC first, fallback normalized title+artist when ISRC is null
- Metadata selection: highest-confidence callback's metadata wins for airplay event
- No minimum confidence threshold -- store all, filter at query time
- No-match callbacks stored in separate lightweight table (station ID, timestamp, type)
- 7-day no-match retention with auto-cleanup via scheduled BullMQ job
- Track last successful detection per station for health signal
- acrcloudStreamId column added to Station model (required, unique, 1:1)
- Webhook lookup by ACRCloud stream ID in callback
- Unknown stream IDs: log warning and discard
- ACRCloud stream ID required when creating a station

### Claude's Discretion
- BullMQ queue names, concurrency settings, and retry policies
- Exact ACRCloud payload field mapping
- No-match cleanup job scheduling interval
- Title/artist normalization algorithm for fallback matching
- Whether to use dedicated BullMQ worker process or co-locate with existing cleanup worker
- Database transaction strategy for detection + airplay event upserts

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DETC-01 | System receives and processes ACRCloud detection callbacks via webhook endpoint | ACRCloud callback envelope structure documented, Fastify route pattern established, TypeBox validation schema derivable from payload format |
| DETC-02 | Each detection stores: station, timestamp, song, artist, duration, ISRC, confidence score | ACRCloud `metadata.music[]` fields mapped to Detection model columns; all required fields present in callback payload |
| DETC-03 | Raw callbacks are deduplicated into single airplay events (gap-tolerance aggregation) | Deduplication algorithm designed: ISRC-first match key, 5min gap tolerance, real-time upsert pattern for AirplayEvent, title+artist normalization for fallback |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | ^5.8.0 | Webhook HTTP endpoint | Already in project, route plugin pattern established |
| @sinclair/typebox | ^0.34.48 | Request/response schema validation | Already in project, used for station routes |
| bullmq | ^5.71.0 | Async job queue for detection processing | Already in project, cleanup worker pattern established |
| ioredis | ^5.4.0 | Redis client for BullMQ + pub/sub | Already in project |
| @prisma/client | ^7.3.0 | ORM for Detection + AirplayEvent writes | Already in project, schema defined |
| pino | ^10.3.0 | Structured logging | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @myfuckingmusic/shared | workspace:* | DetectionStatus enum, DETECTION_GAP_TOLERANCE_MS, types | All detection processing code |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BullMQ async processing | Synchronous in-request processing | Would cause ACRCloud webhook timeouts at scale -- rejected by user decision |
| Prisma upsert for airplay | Raw SQL ON CONFLICT | Prisma upsert is sufficient for single-row operations; raw SQL needed only if batch performance becomes an issue |

**Installation:**
No new packages required. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
  routes/v1/
    webhooks/
      acrcloud/
        index.ts          # Fastify plugin: POST /api/v1/webhooks/acrcloud
        schema.ts         # TypeBox schemas for ACRCloud callback validation
        handlers.ts       # Webhook handler: validate, enqueue, respond 200
  workers/
    cleanup.ts            # Existing segment cleanup worker
    detection.ts          # NEW: Detection processing worker
  lib/
    redis.ts              # Existing Redis connection factory
    prisma.ts             # Existing Prisma client
    pubsub.ts             # Existing pub/sub (extend with detection channels)
    normalization.ts      # NEW: Title/artist normalization utilities
  models/                 # NEW (optional): Data access layer for detection operations
    no-match.ts           # No-match table operations
apps/api/prisma/
  migrations/
    00000000000002_add_acrcloud_stream_id/migration.sql  # Add acrcloudStreamId to stations
    00000000000003_add_no_match_table/migration.sql      # No-match callbacks table
  schema.prisma           # Updated with acrcloudStreamId + NoMatchCallback model
```

### Pattern 1: Webhook Receive-and-Enqueue
**What:** Webhook handler validates auth + schema, enqueues raw callback to BullMQ, returns 200 immediately.
**When to use:** Always -- this is the only entry point for ACRCloud callbacks.
**Example:**
```typescript
// routes/v1/webhooks/acrcloud/handlers.ts
import { Queue } from "bullmq";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { AcrCloudCallbackBody } from "./schema.js";

const DETECTION_QUEUE = "detection-processing";

export async function handleAcrCloudCallback(
  request: FastifyRequest<{ Body: AcrCloudCallbackBody }>,
  reply: FastifyReply,
  detectionQueue: Queue,
): Promise<void> {
  // Auth: check shared secret header
  const secret = request.headers["x-acr-secret"] as string | undefined;
  if (secret !== process.env.ACRCLOUD_WEBHOOK_SECRET) {
    // Return 200 silently to prevent endpoint confirmation
    return reply.status(200).send({ status: "ok" });
  }

  const callback = request.body;

  // Enqueue for async processing
  await detectionQueue.add("process-callback", callback, {
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });

  return reply.status(200).send({ status: "ok" });
}
```

### Pattern 2: Real-Time Gap-Tolerance Deduplication
**What:** Each detection callback is processed against the most recent AirplayEvent for the same song+station. If within gap tolerance, the existing event is extended; otherwise, a new event is created.
**When to use:** In the detection worker for every successful music detection.
**Example:**
```typescript
// workers/detection.ts -- core deduplication logic
async function processDetection(
  stationId: number,
  detectedAt: Date,
  music: AcrCloudMusicResult,
): Promise<void> {
  const matchKey = music.external_ids?.isrc
    ? { isrc: music.external_ids.isrc }
    : {
        songTitle: normalizeTitle(music.title),
        artistName: normalizeArtist(music.artists[0]?.name ?? "Unknown"),
      };

  // Find the most recent airplay event for this song+station
  const recentEvent = await prisma.airplayEvent.findFirst({
    where: {
      stationId,
      ...matchKey,
      endedAt: {
        gte: new Date(detectedAt.getTime() - DETECTION_GAP_TOLERANCE_MS),
      },
    },
    orderBy: { endedAt: "desc" },
  });

  if (recentEvent) {
    // Extend existing airplay event
    await prisma.airplayEvent.update({
      where: { id: recentEvent.id },
      data: {
        endedAt: detectedAt,
        playCount: { increment: 1 },
        // Update metadata if this callback has higher confidence
        ...(music.score > (recentEvent as any)._maxConfidence
          ? { songTitle: music.title, artistName: music.artists[0]?.name }
          : {}),
      },
    });
  } else {
    // Create new airplay event
    await prisma.airplayEvent.create({
      data: {
        stationId,
        startedAt: detectedAt,
        endedAt: detectedAt,
        songTitle: music.title,
        artistName: music.artists[0]?.name ?? "Unknown",
        isrc: music.external_ids?.isrc ?? null,
        playCount: 1,
      },
    });
  }
}
```

### Pattern 3: BullMQ Worker Lifecycle (from existing cleanup worker)
**What:** Worker starts with queue + scheduler, processes jobs, integrates into supervisor shutdown.
**When to use:** For the detection worker -- follow the exact pattern from cleanup.ts.
**Example:**
```typescript
// Follow startCleanupWorker pattern exactly
export async function startDetectionWorker(): Promise<{
  queue: Queue;
  worker: Worker;
}> {
  const queue = new Queue(DETECTION_QUEUE, {
    connection: createRedisConnection(),
  });

  const worker = new Worker(
    DETECTION_QUEUE,
    async (job) => {
      await processCallback(job.data);
    },
    {
      connection: createRedisConnection(),
      concurrency: 10, // I/O-bound: DB writes, can handle parallel
    },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Detection job failed");
  });

  return { queue, worker };
}
```

### Anti-Patterns to Avoid
- **Synchronous webhook processing:** Never do DB writes or deduplication logic inside the webhook handler. ACRCloud has timeout limits and will retry on failure, causing duplicate processing.
- **Batch deduplication on a timer:** The user explicitly chose real-time per-callback aggregation. Do not accumulate callbacks and process in batches.
- **Using ON CONFLICT ON CONSTRAINT with TimescaleDB:** The detections hypertable does not support `ON CONFLICT ON CONSTRAINT` syntax. Use column-list syntax: `ON CONFLICT (raw_callback_id, detected_at)`.
- **Storing full ACRCloud payload in no-match table:** User decision is lightweight: station ID, timestamp, callback type only.
- **Filtering by confidence threshold during ingestion:** User decision: store everything, filter at query time.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue with retry | Custom Redis pub/sub queue | BullMQ | Already in project; handles retries, stalled jobs, concurrency |
| Webhook payload validation | Manual field checking | Fastify + TypeBox schema | Declarative, type-safe, consistent with existing routes |
| Scheduled cleanup jobs | Custom setInterval | BullMQ upsertJobScheduler | Already proven in cleanup worker; survives process restarts |
| Database connection pooling | Manual pg.Pool | Prisma with PrismaPg adapter | Already configured in lib/prisma.ts |
| Unicode normalization | Custom regex chains | String.prototype.normalize("NFKD") + regex | Standard JS API handles all Unicode decomposition |

**Key insight:** Every infrastructure component needed for this phase already exists in the project. The work is connecting ACRCloud callbacks to the existing Detection/AirplayEvent schema through the established BullMQ pattern.

## Common Pitfalls

### Pitfall 1: ACRCloud Callback Timeout Causing Retries
**What goes wrong:** If the webhook endpoint takes too long to respond, ACRCloud retries the callback. This causes duplicate detection records.
**Why it happens:** Processing detection + deduplication in the request handler before responding.
**How to avoid:** Respond 200 immediately, enqueue to BullMQ. Processing is fully async.
**Warning signs:** Detection records with duplicate rawCallbackId values; playCount values that seem too high.

### Pitfall 2: Race Condition in Concurrent Deduplication
**What goes wrong:** Two callbacks for the same song arrive near-simultaneously. Both workers read "no existing airplay event" and both create new events, resulting in duplicates.
**Why it happens:** BullMQ worker concurrency > 1 processes jobs in parallel.
**How to avoid:** Use a composite key query when finding recent events AND handle the potential race with an idempotency check. The `rawCallbackId` unique constraint on Detection serves as a natural deduplication key -- if the insert fails with a unique violation, the callback was already processed. For AirplayEvent, use an ordered processing approach: set BullMQ concurrency to 1 per station (or use a station-based job ID to serialize).
**Warning signs:** Duplicate AirplayEvents for the same song/station/timewindow.

### Pitfall 3: TimescaleDB Hypertable Unique Constraint Requirements
**What goes wrong:** Attempting to create a unique constraint on the detections table that doesn't include `detected_at` (the partition column) fails.
**Why it happens:** TimescaleDB requires all unique constraints on hypertables to include the partitioning column.
**How to avoid:** The schema already handles this correctly -- `rawCallbackId` unique index includes `detected_at`: `@@unique([rawCallbackId, detectedAt])`. Maintain this pattern for any new unique constraints.
**Warning signs:** Migration failures with "cannot create a unique index without the column used for partitioning".

### Pitfall 4: ISRC Can Be Null or Missing
**What goes wrong:** Code assumes ISRC is always present and skips the title+artist fallback path. Songs without ISRC in ACRCloud are never deduplicated.
**Why it happens:** Many songs (especially Romanian/regional content) lack ISRC in ACRCloud's database.
**How to avoid:** Always implement the two-path matching: ISRC when present, normalized title+artist when absent. Test both paths explicitly.
**Warning signs:** Thousands of single-playCount AirplayEvents for the same song, differentiated only by slight title variations.

### Pitfall 5: ACRCloud external_ids.isrc Format Inconsistency
**What goes wrong:** ACRCloud returns ISRC as either a string or an array of strings depending on the match result. Code breaks on unexpected format.
**Why it happens:** The `external_ids.isrc` field can be a single string in some responses and an array in others (multiple ISRCs for the same recording).
**How to avoid:** Always normalize to a single string: `Array.isArray(isrc) ? isrc[0] : isrc`. Use the first ISRC if multiple are provided.
**Warning signs:** Type errors in production, detection records with `null` ISRC where one should exist.

### Pitfall 6: Station Not Found for Stream ID
**What goes wrong:** ACRCloud sends a callback with a stream_id that doesn't match any station in the database. Processing fails repeatedly, filling the dead letter queue.
**Why it happens:** Station was deleted, ACRCloud stream was reconfigured, or stream_id was never registered.
**How to avoid:** Look up station by `acrcloudStreamId` first. If not found, log a warning and skip (do not retry -- this is a config issue, not a transient error). Mark the job as completed (not failed) to prevent retry loops.
**Warning signs:** Growing failed job count in the detection queue; repeated log warnings about unknown stream IDs.

## Code Examples

### ACRCloud Callback TypeBox Schema
```typescript
// routes/v1/webhooks/acrcloud/schema.ts
import { Type, type Static } from "@sinclair/typebox";

// ACRCloud music result within metadata
const AcrMusicResultSchema = Type.Object({
  title: Type.String(),
  artists: Type.Array(Type.Object({ name: Type.String() })),
  album: Type.Optional(Type.Object({ name: Type.Optional(Type.String()) })),
  duration_ms: Type.Number(),
  score: Type.Number(),
  acrid: Type.String(),
  play_offset_ms: Type.Optional(Type.Number()),
  external_ids: Type.Optional(
    Type.Object({
      isrc: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())])),
      upc: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())])),
    }),
  ),
  external_metadata: Type.Optional(Type.Unknown()),
  release_date: Type.Optional(Type.String()),
  label: Type.Optional(Type.String()),
  genres: Type.Optional(Type.Array(Type.Object({ name: Type.String() }))),
  result_from: Type.Optional(Type.Number()),
  sample_begin_time_offset_ms: Type.Optional(Type.Number()),
  sample_end_time_offset_ms: Type.Optional(Type.Number()),
  db_begin_time_offset_ms: Type.Optional(Type.Number()),
  db_end_time_offset_ms: Type.Optional(Type.Number()),
});

const AcrMetadataSchema = Type.Object({
  music: Type.Optional(Type.Array(AcrMusicResultSchema)),
  timestamp_utc: Type.String(),
  played_duration: Type.Optional(Type.Number()),
  type: Type.Optional(Type.String()),
});

const AcrStatusSchema = Type.Object({
  msg: Type.String(),
  code: Type.Number(),
  version: Type.Optional(Type.String()),
});

const AcrDataSchema = Type.Object({
  status: AcrStatusSchema,
  result_type: Type.Optional(Type.Number()),
  metadata: Type.Optional(AcrMetadataSchema),
});

export const AcrCloudCallbackSchema = Type.Object({
  stream_id: Type.String(),
  stream_url: Type.Optional(Type.String()),
  stream_name: Type.Optional(Type.String()),
  status: Type.Number(),
  data: AcrDataSchema,
});

export type AcrCloudCallbackBody = Static<typeof AcrCloudCallbackSchema>;
```

### Title/Artist Normalization
```typescript
// lib/normalization.ts

/**
 * Normalize a music title for deduplication matching.
 *
 * Steps:
 * 1. Unicode NFKD decomposition (decompose accented chars)
 * 2. Strip combining diacritical marks
 * 3. Lowercase
 * 4. Remove content in parentheses/brackets (remix info, feat. credits)
 * 5. Collapse whitespace
 * 6. Trim
 */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")  // strip diacritics
    .toLowerCase()
    .replace(/\s*[\(\[][^\)\]]*[\)\]]\s*/g, " ")  // remove (remix), [feat. X]
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize an artist name for deduplication matching.
 *
 * Steps:
 * 1. Unicode NFKD decomposition
 * 2. Strip diacritical marks
 * 3. Lowercase
 * 4. Normalize separators: & -> and, ; -> and, feat. -> and
 * 5. Collapse whitespace
 * 6. Trim
 */
export function normalizeArtist(artist: string): string {
  return artist
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s*[&;]\s*/g, " and ")
    .replace(/\s*feat\.?\s*/gi, " and ")
    .replace(/\s+/g, " ")
    .trim();
}
```

### Detection Worker Processing Logic
```typescript
// workers/detection.ts -- job processor sketch
import { DETECTION_GAP_TOLERANCE_MS } from "@myfuckingmusic/shared";

async function processCallback(callback: AcrCloudCallbackBody): Promise<void> {
  const { stream_id, data } = callback;

  // 1. Look up station by ACRCloud stream ID
  const station = await prisma.station.findFirst({
    where: { acrcloudStreamId: stream_id },
  });
  if (!station) {
    logger.warn({ stream_id }, "Unknown ACRCloud stream ID, discarding");
    return; // Complete job successfully -- not a transient error
  }

  // 2. Handle no-result callbacks (code 1001)
  if (data.status.code === 1001 || !data.metadata?.music?.length) {
    await prisma.noMatchCallback.create({
      data: {
        stationId: station.id,
        callbackAt: new Date(data.metadata?.timestamp_utc ?? new Date()),
        statusCode: data.status.code,
      },
    });
    return;
  }

  // 3. Process each music result (usually just one)
  const timestamp = new Date(data.metadata!.timestamp_utc);
  for (const music of data.metadata!.music!) {
    const isrc = normalizeIsrc(music.external_ids?.isrc);

    // Insert Detection record
    await prisma.detection.create({
      data: {
        stationId: station.id,
        detectedAt: timestamp,
        songTitle: music.title,
        artistName: music.artists[0]?.name ?? "Unknown",
        albumTitle: music.album?.name ?? null,
        isrc,
        confidence: music.score / 100, // Normalize to 0-1
        durationMs: music.duration_ms,
        rawCallbackId: `${stream_id}-${data.metadata!.timestamp_utc}`,
      },
    });

    // Deduplication: find or create AirplayEvent
    await upsertAirplayEvent(station.id, timestamp, music, isrc);
  }

  // 4. Update station last detection timestamp for health monitoring
  await prisma.station.update({
    where: { id: station.id },
    data: { lastHeartbeat: timestamp },
  });
}
```

### No-Match Table Schema Addition
```sql
-- Migration: add_no_match_table
CREATE TABLE "no_match_callbacks" (
  "id" SERIAL NOT NULL,
  "station_id" INTEGER NOT NULL,
  "callback_at" TIMESTAMP(3) NOT NULL,
  "status_code" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "no_match_callbacks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "no_match_callbacks_station_id_callback_at_idx"
  ON "no_match_callbacks"("station_id", "callback_at");
CREATE INDEX "no_match_callbacks_created_at_idx"
  ON "no_match_callbacks"("created_at");
```

## ACRCloud Callback Payload Reference

### Full Callback Envelope (SUCCESS -- code 0)
```json
{
  "stream_id": "s-abc123",
  "stream_url": "http://example.com/stream",
  "stream_name": "Radio Romania",
  "stream_country": "RO",
  "bucket_id": "12345",
  "status": 1,
  "data": {
    "status": { "msg": "Success", "code": 0, "version": "1.0" },
    "result_type": 0,
    "metadata": {
      "timestamp_utc": "2026-03-15 14:30:00",
      "played_duration": 173,
      "type": "delay",
      "music": [
        {
          "title": "Doua Inimi",
          "artists": [{ "name": "Irina Rimes" }],
          "album": { "name": "Despre El" },
          "duration_ms": 186506,
          "score": 100.0,
          "acrid": "abc123def456",
          "play_offset_ms": 75500,
          "release_date": "2023-01-15",
          "label": "Global Records",
          "genres": [{ "name": "Pop" }],
          "external_ids": { "isrc": "ROA231600001", "upc": "1234567890" },
          "external_metadata": { "spotify": {}, "deezer": {} },
          "result_from": 3,
          "sample_begin_time_offset_ms": 6440,
          "sample_end_time_offset_ms": 9420,
          "db_begin_time_offset_ms": 72200,
          "db_end_time_offset_ms": 75180
        }
      ]
    }
  }
}
```

### No-Result Callback (code 1001)
```json
{
  "stream_id": "s-abc123",
  "stream_url": "http://example.com/stream",
  "status": 1,
  "data": {
    "status": { "msg": "No result", "code": 1001, "version": "1.0" },
    "result_type": 0,
    "metadata": {
      "timestamp_utc": "2026-03-15 14:35:00",
      "played_duration": 0
    }
  }
}
```

### ACRCloud Status Codes Reference
| Code | Meaning | Action |
|------|---------|--------|
| 0 | Recognition success | Process music metadata |
| 1001 | No recognition result | Store in no-match table |
| 2000-3015 | Various errors | Log and discard |

### Field Mapping: ACRCloud -> Detection Model
| ACRCloud Field | Detection Column | Transform |
|----------------|-----------------|-----------|
| `metadata.timestamp_utc` | `detectedAt` | Parse as UTC Date |
| `music[0].title` | `songTitle` | Direct string |
| `music[0].artists[0].name` | `artistName` | Direct string |
| `music[0].album.name` | `albumTitle` | Nullable string |
| `music[0].external_ids.isrc` | `isrc` | Normalize: array -> first element, string -> direct |
| `music[0].score` | `confidence` | Divide by 100 (ACRCloud uses 0-100, schema expects 0-1) |
| `music[0].duration_ms` | `durationMs` | Direct number |
| `stream_id` + `timestamp_utc` | `rawCallbackId` | Composite string for idempotency |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BullMQ repeatable jobs | BullMQ v5.16+ `upsertJobScheduler` | BullMQ v5.16 | Existing cleanup worker already uses new API |
| Prisma interactive transactions | Prisma 7 `$transaction` with batch operations | Prisma 7 | Project already on Prisma 7 |
| Manual Redis queue | BullMQ v5 with dedicated connection per component | BullMQ v5 | maxRetriesPerRequest: null required (already set) |

**Deprecated/outdated:**
- BullMQ repeatable jobs API: replaced by `upsertJobScheduler` in v5.16+ (project already uses new API)
- Prisma `$executeRaw` for upserts: Prisma 7 `upsert()` handles single-row cases natively

## Discretionary Recommendations

### BullMQ Queue Names and Settings
- **Detection queue name:** `detection-processing`
- **No-match cleanup queue name:** `no-match-cleanup` (or add as a second scheduler to the existing `segment-cleanup` queue)
- **Detection worker concurrency:** 10 (I/O-bound: DB writes only; ACRCloud sends ~200 callbacks/10sec across all stations; 10 concurrent workers handles bursts comfortably)
- **Retry policy:** 3 attempts with exponential backoff (delay: 1000, 5000, 25000ms). Unknown stream ID errors should NOT retry (mark complete).
- **Job removal:** `removeOnComplete: 1000` (keep last 1000 for debugging), `removeOnFail: 5000`

### No-Match Cleanup Scheduling
- **Interval:** Every 6 hours via BullMQ upsertJobScheduler
- **Retention:** Delete no_match_callbacks where `created_at < NOW() - INTERVAL '7 days'`
- **Co-locate with cleanup worker:** Add the no-match cleanup as a second scheduler in the existing cleanup.ts worker rather than creating a separate process. This follows the established pattern and reduces operational complexity.

### Worker Process Architecture
- **Recommendation:** Co-locate detection worker startup within the supervisor process (alongside the existing cleanup worker), rather than a separate process. Rationale: the supervisor already orchestrates BullMQ workers, has graceful shutdown wired up, and a single process simplifies deployment. If detection volume grows beyond what one process handles, extract later.
- **Alternative if needed:** Separate `pnpm run detection-worker` script for independent scaling.

### Database Transaction Strategy
- **Detection insert + AirplayEvent upsert:** Use Prisma interactive `$transaction` to wrap both operations. If the AirplayEvent upsert fails, the Detection insert should also roll back to maintain consistency.
- **Idempotency:** The `rawCallbackId` unique constraint on Detection prevents duplicate processing. If a duplicate is detected (unique violation), skip the entire callback gracefully.

### Title/Artist Normalization Algorithm
- Use Unicode NFKD decomposition + diacritics stripping + lowercase + whitespace normalization
- Remove parenthetical content from titles (remix info, version markers)
- Normalize artist separators (& ; feat. -> "and")
- Store normalized versions as additional columns OR compute at query time. Recommendation: compute at query time initially (simpler schema), add denormalized columns if performance requires it.

### Confidence Score Handling
- ACRCloud returns `score` as 0-100 float. Detection model stores `confidence` as Float.
- **Recommendation:** Store as 0-1 range (divide by 100) for consistency with standard confidence score conventions.
- For AirplayEvent metadata selection (highest-confidence wins): track the max confidence seen so far. Since AirplayEvent doesn't have a confidence column, store the highest-confidence Detection's metadata during upsert by comparing the incoming score against the current AirplayEvent's metadata source.

## Open Questions

1. **ACRCloud callback authentication header name**
   - What we know: User decided on shared secret header (X-ACR-Secret or similar)
   - What's unclear: ACRCloud may use a specific header name in their webhook configuration, or allow custom header configuration
   - Recommendation: Use `X-ACR-Secret` as the header name. This can be reconfigured in ACRCloud's webhook settings. Environment variable: `ACRCLOUD_WEBHOOK_SECRET`

2. **ACRCloud callback frequency per stream**
   - What we know: ACRCloud sends callbacks every ~10 seconds per monitored stream
   - What's unclear: Exact callback interval and whether it varies by plan tier
   - Recommendation: Design for ~6 callbacks/minute/stream = ~1200 callbacks/minute for 200 streams. BullMQ concurrency of 10 handles this comfortably (200ms avg DB write time -> 50 jobs/sec throughput).

3. **Confidence score column on AirplayEvent**
   - What we know: User wants highest-confidence callback's metadata to win for the airplay event
   - What's unclear: Current AirplayEvent schema has no confidence column to track which callback provided the metadata
   - Recommendation: Add a `confidence` Float column to AirplayEvent during the schema migration. This enables tracking which detection's metadata was selected and enables future quality filtering.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `cd apps/api && pnpm test` |
| Full suite command | `cd apps/api && pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DETC-01 | Webhook receives ACRCloud callback, validates auth+schema, enqueues to BullMQ, responds 200 | unit + integration | `cd apps/api && pnpm vitest run tests/routes/webhooks-acrcloud.test.ts -x` | No - Wave 0 |
| DETC-01 | Failed auth returns 200 silently (no leak) | unit | `cd apps/api && pnpm vitest run tests/routes/webhooks-acrcloud.test.ts -x` | No - Wave 0 |
| DETC-01 | Malformed payload returns 400 | unit | `cd apps/api && pnpm vitest run tests/routes/webhooks-acrcloud.test.ts -x` | No - Wave 0 |
| DETC-02 | Detection record created with all required fields from ACRCloud callback | unit | `cd apps/api && pnpm vitest run tests/workers/detection.test.ts -x` | No - Wave 0 |
| DETC-02 | Station lookup by acrcloudStreamId works correctly | unit | `cd apps/api && pnpm vitest run tests/workers/detection.test.ts -x` | No - Wave 0 |
| DETC-02 | Unknown stream_id logged and discarded (no crash) | unit | `cd apps/api && pnpm vitest run tests/workers/detection.test.ts -x` | No - Wave 0 |
| DETC-03 | Two callbacks within 5min gap for same ISRC create one AirplayEvent with playCount=2 | unit | `cd apps/api && pnpm vitest run tests/workers/detection.test.ts -x` | No - Wave 0 |
| DETC-03 | Two callbacks beyond 5min gap create two separate AirplayEvents | unit | `cd apps/api && pnpm vitest run tests/workers/detection.test.ts -x` | No - Wave 0 |
| DETC-03 | Fallback to normalized title+artist when ISRC is null | unit | `cd apps/api && pnpm vitest run tests/workers/detection.test.ts -x` | No - Wave 0 |
| DETC-03 | Highest-confidence callback metadata wins for AirplayEvent | unit | `cd apps/api && pnpm vitest run tests/workers/detection.test.ts -x` | No - Wave 0 |
| DETC-03 | No-match callback stored in lightweight table | unit | `cd apps/api && pnpm vitest run tests/workers/detection.test.ts -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/api && pnpm test`
- **Per wave merge:** `cd apps/api && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/tests/routes/webhooks-acrcloud.test.ts` -- covers DETC-01 webhook route
- [ ] `apps/api/tests/workers/detection.test.ts` -- covers DETC-02, DETC-03 processing + deduplication
- [ ] `apps/api/tests/lib/normalization.test.ts` -- covers title/artist normalization functions
- [ ] Framework install: none needed (Vitest already configured)

## Sources

### Primary (HIGH confidence)
- ACRCloud Custom Streams API docs (https://docs.acrcloud.com/reference/console-api/bm-projects/custom-streams-projects) -- callback envelope structure, stream_id field format, configuration options
- ACRCloud Broadcast Database Channels Results (https://docs.acrcloud.com/reference/console-api/bm-projects/broadcast-database-projects/channels-results) -- full music metadata JSON structure with all fields
- ACRCloud Error Codes (https://docs.acrcloud.com/sdk-reference/error-codes) -- status code 0 (success), 1001 (no result), error ranges
- Existing project codebase -- Prisma schema, BullMQ cleanup worker pattern, Fastify route patterns, TypeBox validation, shared constants/types
- BullMQ official docs (https://docs.bullmq.io/guide/workers/concurrency) -- concurrency configuration

### Secondary (MEDIUM confidence)
- ACRCloud Broadcast Monitoring Music tutorial (https://docs.acrcloud.com/tutorials/broadcast-monitoring-for-music) -- callback configuration options, result types
- Columbia Music Normalization reference (http://labrosa.ee.columbia.edu/projects/musicsim/normalization.html) -- title/artist normalization strategies for music metadata

### Tertiary (LOW confidence)
- ACRCloud `external_ids.isrc` array vs string format -- observed in community implementations but not explicitly documented in official docs. Defensive coding (handle both) is safe regardless.
- ACRCloud callback frequency (~10 seconds per stream) -- commonly cited in community forums but exact interval may vary by plan tier. Design for higher throughput than expected.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, versions confirmed from package.json
- Architecture: HIGH -- follows established project patterns (route plugin, BullMQ worker, TypeBox), deduplication algorithm is straightforward
- Pitfalls: HIGH -- TimescaleDB constraints documented in migration SQL, ACRCloud payload format verified from official docs, race conditions are well-understood BullMQ patterns
- ACRCloud payload format: MEDIUM-HIGH -- core structure verified from official docs, edge cases (isrc array format) from community sources

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (30 days -- stable domain, no fast-moving dependencies)
