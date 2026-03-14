# Phase 4: Audio Snippet System - Research

**Researched:** 2026-03-15
**Domain:** Audio extraction (FFmpeg), cloud storage (Cloudflare R2), async job processing (BullMQ)
**Confidence:** HIGH

## Summary

Phase 4 captures 5-second audio clips from the ring buffer at detection time, encodes them as AAC 128kbps, uploads to Cloudflare R2, and links them to AirplayEvent records. The system uses three established technologies: FFmpeg for audio extraction/encoding (already in the project for stream recording), AWS SDK v3 for R2 uploads (S3-compatible API), and BullMQ for async job processing (already used for detection and cleanup workers).

The key technical challenge is mapping a detection timestamp back to the correct MPEG-TS segment files on disk, concatenating the relevant segments, and seeking to the precise offset for a 5-second window. The ring buffer uses `segment_time 10` with `segment_wrap 20` (200s total), giving approximately 3 minutes of audio history. Since detections should arrive within seconds of broadcast, the segments will reliably be available.

**Primary recommendation:** Use `child_process.spawn` with FFmpeg's concat protocol (`concat:seg1.ts|seg2.ts`) and `-ss`/`-t` flags to extract and encode in a single pass, upload the resulting AAC file to R2 via `@aws-sdk/client-s3`, and store the R2 object key on AirplayEvent.snippetUrl. Run as a BullMQ worker with concurrency 2 (CPU-bound FFmpeg encoding).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- 5-second clip centered on detection timestamp (2.5s before + 2.5s after the detection moment)
- Use the broadcast timestamp from the ACRCloud callback payload (not webhook arrival time) to find the right ring buffer segment
- One snippet per airplay event -- first detection in an airplay event triggers snippet extraction, subsequent callbacks for the same play are skipped
- Best-effort, non-blocking -- snippet job runs async via BullMQ; if extraction fails, the AirplayEvent is saved without a snippet (snippetUrl stays null)
- Store the R2 object key (not a presigned URL) in the `snippetUrl` field on AirplayEvent (e.g., `snippets/42/2026-03-15/789.aac`)
- Presigned URLs generated on demand with 24-hour expiry
- Dedicated API endpoint: `GET /api/v1/airplay-events/:id/snippet` returns a fresh presigned URL
- Authentication required to request a snippet URL (valid JWT) -- the presigned URL itself works without auth (R2 serves directly)
- Snippets kept indefinitely -- no auto-deletion or retention policy
- R2 key pattern: `snippets/{stationId}/{YYYY-MM-DD}/{airplayEventId}.aac`
- Global kill switch via `SNIPPETS_ENABLED` environment variable (true/false) -- when disabled, snippet jobs are skipped silently, detections still flow without audio capture
- Global toggle only (no per-station granularity for v1)
- If ring buffer doesn't contain the required segment (too late, stream was down), skip silently -- snippetUrl stays null on the airplay event
- No retry mechanism for missed snippets -- the audio is gone once the ring buffer overwrites
- Target SLA: snippet should be available in R2 within 30 seconds of detection processing

### Claude's Discretion
- FFmpeg extraction command and segment-seeking logic
- BullMQ snippet worker concurrency (CPU-bound -- balance speed vs system load)
- R2 client library and upload implementation
- Presigned URL generation approach (R2 SDK or S3-compatible API)
- Temporary file handling during extraction and encoding
- Error logging format and structured fields for monitoring
- Whether snippet worker runs as a separate process or co-located with detection worker

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFR-03 | System captures 5-second audio snippets from recorded stream at moment of detection | FFmpeg concat protocol + seek logic extracts precisely 5s from ring buffer segments; BullMQ worker processes extraction async; detection worker enqueues snippet job when creating new AirplayEvent |
| INFR-04 | Snippets stored in cloud storage (Cloudflare R2) with AAC 128kbps encoding | @aws-sdk/client-s3 uploads to R2 via S3-compatible API; FFmpeg encodes with `-c:a aac -b:a 128k`; R2 object key stored on AirplayEvent.snippetUrl; presigned URLs generated on-demand via @aws-sdk/s3-request-presigner |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @aws-sdk/client-s3 | ^3.700 | R2 upload (PutObject) | Official Cloudflare-recommended S3-compatible SDK; R2 docs use this exclusively |
| @aws-sdk/s3-request-presigner | ^3.700 | Presigned URL generation (GetObject) | Official companion package for presigning; Cloudflare R2 docs reference this |
| FFmpeg (system binary) | any | Audio extraction and AAC encoding | Already installed for stream recording; project uses child_process.spawn pattern |
| BullMQ | ^5.71 (existing) | Async snippet extraction queue | Already used for detection and cleanup workers; same lifecycle pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pino | ^10.3 (existing) | Structured logging for snippet worker | Already used by all workers; consistent logging format |
| ioredis | ^5.4 (existing) | BullMQ connection | Already configured with createRedisConnection() |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @aws-sdk/client-s3 | aws4fetch | Lighter weight but less feature coverage; no presigner built in |
| child_process.spawn FFmpeg | fluent-ffmpeg | Deprecated/archived May 2025; project already uses spawn pattern; adds unnecessary dependency |
| BullMQ worker | Direct async call | Violates non-blocking requirement; no retry capability; no job visibility |

**Installation:**
```bash
cd apps/api && pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

No FFmpeg install needed (already present for stream recording).

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
  workers/
    snippet.ts           # BullMQ snippet extraction worker
  lib/
    r2.ts                # R2 client singleton + upload/presign helpers
    segment-resolver.ts  # Maps detection timestamp -> segment files + offset
  routes/v1/
    airplay-events/
      index.ts           # Route registration for snippet endpoint
      schema.ts          # TypeBox validation schemas
      handlers.ts        # GET /:id/snippet handler
```

### Pattern 1: Segment Timestamp Resolution
**What:** Given a detection timestamp, determine which MPEG-TS segment files contain the required 5-second window and calculate the seek offset within the concatenated segments.
**When to use:** Every snippet extraction job.
**Logic:**

The ring buffer uses: `segment_time 10`, `segment_wrap 20`, output pattern `segment-%03d.ts`. Segments are numbered 000-019 and wrap. Each segment covers ~10 seconds of audio.

To find the right segments for a detection at time T:
1. List all segment files in `data/streams/{stationId}/` directory
2. Get each file's `mtime` (last modification time) from the filesystem
3. The most recently modified segment is the "current" one being written
4. Walk backwards by mtime to find segments whose time range covers [T - 2.5s, T + 2.5s]
5. Since detection callbacks arrive within seconds (well under the 3-minute buffer window), the relevant segments will virtually always be present

**Important:** We cannot rely on segment numbering alone because `segment_wrap` causes numbers to cycle. The filesystem `mtime` is the source of truth for which segment covers which time period.

```typescript
// Source: Project analysis of ffmpeg.ts configuration
interface SegmentInfo {
  path: string;
  mtime: number; // ms timestamp of last modification
}

/**
 * Find segment files that cover a time window.
 * Segments are ~10s each. We need segments covering [targetTime - 2.5s, targetTime + 2.5s].
 *
 * Returns sorted segments (oldest first) and the seek offset within the first segment.
 */
async function resolveSegments(
  stationId: number,
  detectedAt: Date,
): Promise<{ segments: string[]; seekOffsetSeconds: number } | null> {
  const segmentDir = path.join(DATA_DIR, String(stationId));
  const files = await fs.readdir(segmentDir);

  // Get mtime for each segment file
  const segmentInfos: SegmentInfo[] = [];
  for (const file of files) {
    if (!file.endsWith('.ts')) continue;
    const filePath = path.join(segmentDir, file);
    const stat = await fs.stat(filePath);
    segmentInfos.push({ path: filePath, mtime: stat.mtimeMs });
  }

  // Sort by mtime ascending (oldest first)
  segmentInfos.sort((a, b) => a.mtime - b.mtime);

  const targetMs = detectedAt.getTime();
  const windowStart = targetMs - 2500; // 2.5s before
  const windowEnd = targetMs + 2500;   // 2.5s after

  // Each segment covers approximately [mtime - 10000, mtime]
  // (mtime is when FFmpeg finished writing the segment)
  const relevantSegments = segmentInfos.filter(seg => {
    const segStart = seg.mtime - 10000; // segment started ~10s before its mtime
    const segEnd = seg.mtime;
    return segEnd >= windowStart && segStart <= windowEnd;
  });

  if (relevantSegments.length === 0) return null;

  // Calculate seek offset: time from start of first segment to window start
  const firstSegStart = relevantSegments[0].mtime - 10000;
  const seekOffsetSeconds = Math.max(0, (windowStart - firstSegStart) / 1000);

  return {
    segments: relevantSegments.map(s => s.path),
    seekOffsetSeconds,
  };
}
```

### Pattern 2: FFmpeg Extraction + Encoding (Single Pass)
**What:** Concatenate relevant MPEG-TS segments and extract a 5-second AAC clip in one FFmpeg invocation.
**When to use:** In the snippet worker for each extraction job.
**Example:**

```typescript
// Source: FFmpeg documentation + project ffmpeg.ts spawn pattern
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

async function extractSnippet(
  segments: string[],
  seekOffsetSeconds: number,
  outputPath: string,
): Promise<void> {
  // Use concat protocol for MPEG-TS (supported natively)
  const concatInput = `concat:${segments.join('|')}`;

  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-y',                          // overwrite output
      '-ss', String(seekOffsetSeconds), // seek to offset (input-side, fast)
      '-i', concatInput,             // concat MPEG-TS segments
      '-t', '5',                     // extract 5 seconds
      '-vn',                         // discard video (audio only)
      '-c:a', 'aac',                 // encode to AAC
      '-b:a', '128k',               // 128kbps bitrate
      '-ar', '44100',               // standard sample rate
      '-ac', '2',                    // stereo
      '-f', 'adts',                  // raw AAC output (ADTS framing)
      outputPath,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });

    proc.on('error', reject);
  });
}
```

### Pattern 3: R2 Client Singleton
**What:** Initialize S3Client once for Cloudflare R2 and export upload/presign helper functions.
**When to use:** In `lib/r2.ts`, consumed by snippet worker and snippet route handler.
**Example:**

```typescript
// Source: Cloudflare R2 docs (aws-sdk-js-v3 example)
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string = 'audio/aac',
): Promise<void> {
  await r2Client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

export async function getPresignedUrl(
  key: string,
  expiresInSeconds: number = 86400, // 24 hours
): Promise<string> {
  return getSignedUrl(
    r2Client,
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }),
    { expiresIn: expiresInSeconds },
  );
}
```

### Pattern 4: Snippet Worker (BullMQ)
**What:** BullMQ worker that processes snippet extraction jobs -- follows the exact same lifecycle pattern as detection.ts and cleanup.ts.
**When to use:** Co-located with other workers in supervisor startup.

```typescript
// Source: Project patterns from detection.ts and cleanup.ts
import { Worker, Queue } from 'bullmq';
import { createRedisConnection } from '../lib/redis.js';

const SNIPPET_QUEUE = 'snippet-extraction';

export async function startSnippetWorker(): Promise<{
  queue: Queue;
  worker: Worker;
}> {
  const queue = new Queue(SNIPPET_QUEUE, {
    connection: createRedisConnection(),
  });

  const worker = new Worker(
    SNIPPET_QUEUE,
    async (job) => {
      await processSnippetJob(job.data);
    },
    {
      connection: createRedisConnection(),
      concurrency: 2,  // CPU-bound (FFmpeg encoding), keep low
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 2000 },
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Snippet extraction job failed');
  });

  return { queue, worker };
}
```

### Pattern 5: Detection Worker Integration
**What:** The detection worker enqueues a snippet job when creating a NEW AirplayEvent (not when extending an existing one).
**When to use:** Modify `processCallback()` in detection.ts.

```typescript
// After the "Create new AirplayEvent" block (line ~222 in detection.ts):
// Only enqueue snippet for NEW airplay events, not extensions
if (!recentEvent) {
  const newEvent = await prisma.airplayEvent.create({ ... });

  // Enqueue snippet extraction (best-effort, non-blocking)
  if (process.env.SNIPPETS_ENABLED === 'true') {
    await snippetQueue.add('extract', {
      airplayEventId: newEvent.id,
      stationId: station.id,
      detectedAt: detectedAt.toISOString(),
    });
  }
}
```

### Anti-Patterns to Avoid
- **Storing presigned URLs in the database:** URLs expire (24h); store R2 object keys instead and generate presigned URLs on demand.
- **Synchronous snippet extraction in detection worker:** FFmpeg encoding is CPU-bound and takes ~1-2 seconds; blocking the detection pipeline would cause callback backlog.
- **High concurrency for snippet worker:** FFmpeg is CPU-bound; concurrency > 2-3 just adds overhead without throughput gains. Scale with additional worker processes if needed.
- **Relying on segment file numbering for timestamp calculation:** `segment_wrap 20` causes numbers to cycle (000->019->000...); file mtime is the only reliable time indicator.
- **Using temporary files in a shared directory:** Use `os.tmpdir()` with unique prefixes per job to avoid conflicts between concurrent extractions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| S3-compatible upload | Custom HTTP requests with AWS SigV4 signing | @aws-sdk/client-s3 | SigV4 signing is complex; SDK handles retries, streaming, checksums |
| Presigned URL generation | Manual URL construction with signature | @aws-sdk/s3-request-presigner | Signature calculation is crypto-intensive and error-prone |
| Audio encoding | Custom audio codec integration | FFmpeg via child_process.spawn | FFmpeg is the industry standard; handles all codec edge cases |
| Job queue with retries | Promise queue with setTimeout retries | BullMQ | Already in project; handles concurrency, persistence, dead-letter, visibility |
| MPEG-TS demuxing | Custom TS packet parser | FFmpeg concat protocol | MPEG-TS is a complex container format with PES/PAT/PMT tables |

**Key insight:** Every component in this phase has a battle-tested solution. The only custom code is the segment timestamp resolution logic (mapping detection time to filesystem segments), which is project-specific glue code that cannot be avoided.

## Common Pitfalls

### Pitfall 1: Segment File Race Condition
**What goes wrong:** The cleanup worker deletes a segment file between the time the snippet worker identifies it and attempts to read it.
**Why it happens:** Cleanup runs every 30 seconds with a 3-minute age threshold. A snippet job could be queued but not yet processed when cleanup runs.
**How to avoid:** Snippet jobs should be processed promptly (within seconds). The 3-minute cleanup age vs. the 30-second snippet SLA gives ample margin. If a segment is missing during extraction, fail gracefully (snippetUrl stays null).
**Warning signs:** Sporadic "file not found" errors in snippet worker logs.

### Pitfall 2: FFmpeg Seek Inaccuracy with MPEG-TS
**What goes wrong:** FFmpeg cannot seek to exact timestamps in MPEG-TS containers because seek granularity is limited to keyframe positions.
**Why it happens:** MPEG-TS seeking works at the transport stream packet level, not sample-accurate. Using `-ss` as an input option (before `-i`) seeks to the nearest keyframe.
**How to avoid:** Use `-ss` as an input option (before `-i`) for fast seeking, combined with `-accurate_seek` (enabled by default when transcoding). Since we're re-encoding to AAC (not stream-copying), FFmpeg will decode from the nearest keyframe and start encoding from the precise timestamp. The result is sample-accurate.
**Warning signs:** Snippets that start slightly before or after the expected timestamp (only relevant if stream-copying, which we are NOT doing).

### Pitfall 3: R2 Presigned URL CORS Issues
**What goes wrong:** iOS app or web client cannot play the audio from the presigned URL due to CORS restrictions.
**Why it happens:** Cloudflare R2 requires explicit CORS configuration on the bucket to allow cross-origin requests.
**How to avoid:** Configure CORS rules on the R2 bucket to allow GET requests from the app's origin. For the iOS native app, CORS is not an issue (only browsers enforce CORS). Still, configure it now for future web dashboard (Phase 6+).
**Warning signs:** 403 errors when the iOS app tries to play a snippet URL (unlikely for native app, more likely for web).

### Pitfall 4: Missing R2 Credentials at Runtime
**What goes wrong:** Snippet worker crashes or fails all jobs because R2 environment variables are not set.
**Why it happens:** New environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) must be added to deployment config.
**How to avoid:** Validate R2 env vars at startup when SNIPPETS_ENABLED=true. If missing, log a clear error and skip snippet processing rather than crashing.
**Warning signs:** All snippet jobs fail with "credentials not provided" errors.

### Pitfall 5: Temporary File Cleanup
**What goes wrong:** Failed FFmpeg extractions leave orphan .aac files in the temp directory, eventually filling disk.
**Why it happens:** FFmpeg writes to a temp file, but if the process is killed or the upload fails, the file is never cleaned up.
**How to avoid:** Use try/finally to always delete the temp file after processing (success or failure). Use `os.tmpdir()` so the OS can also clean up on reboot.
**Warning signs:** Growing disk usage in /tmp or os.tmpdir().

### Pitfall 6: Detection Worker Already Runs -- Snippet Queue Must Be Injected
**What goes wrong:** The detection worker needs access to the snippet queue to enqueue jobs, but the queue is created in a different module.
**Why it happens:** Current detection worker is a self-contained module with no external queue dependencies.
**How to avoid:** Create the snippet queue in the supervisor and pass it to the detection worker, or create it within the detection worker module and export it. The cleanest approach: create the snippet queue in supervisor/index.ts alongside the other queues, and modify `startDetectionWorker` to accept a snippet queue parameter.
**Warning signs:** Circular dependencies between worker modules.

## Code Examples

Verified patterns from official sources and project codebase:

### R2 Upload with File Buffer
```typescript
// Source: Cloudflare R2 docs + @aws-sdk/client-s3 docs
import fs from 'node:fs/promises';
import { uploadToR2 } from '../lib/r2.js';

// Read the temp file and upload
const fileBuffer = await fs.readFile(tempFilePath);
const r2Key = `snippets/${stationId}/${formatDate(detectedAt)}/${airplayEventId}.aac`;
await uploadToR2(r2Key, fileBuffer, 'audio/aac');
```

### Presigned URL Route Handler
```typescript
// Source: Project route patterns (stations/handlers.ts) + R2 presigned URL docs
import type { FastifyRequest, FastifyReply } from 'fastify';
import { getPresignedUrl } from '../../lib/r2.js';
import { prisma } from '../../lib/prisma.js';

export async function getSnippetUrl(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const airplayEventId = parseInt(request.params.id, 10);

  const event = await prisma.airplayEvent.findUnique({
    where: { id: airplayEventId },
  });

  if (!event) {
    return reply.code(404).send({ error: 'Airplay event not found' });
  }

  if (!event.snippetUrl) {
    return reply.code(404).send({ error: 'No snippet available for this event' });
  }

  // snippetUrl stores the R2 object key, not a presigned URL
  const presignedUrl = await getPresignedUrl(event.snippetUrl, 86400); // 24h

  return reply.send({ url: presignedUrl, expiresIn: 86400 });
}
```

### Environment Variables
```bash
# R2 configuration (add to .env and .env.example)
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=myfuckingmusic-snippets
SNIPPETS_ENABLED=true
```

### Supervisor Integration
```typescript
// Source: Project supervisor/index.ts pattern
// In startSupervisor():

// --- Start snippet worker ---
const { queue: snippetQueue, worker: snippetWorker } =
  await startSnippetWorker();

// Pass snippet queue to detection worker so it can enqueue extraction jobs
const { queue: detectionQueue, worker: detectionWorker } =
  await startDetectionWorker({ snippetQueue });

// In shutdown handler (ordered: detection -> snippet -> cleanup):
const shutdown = async () => {
  watchdog.stop();
  await detectionWorker.close();
  await detectionQueue.close();
  await snippetWorker.close();
  await snippetQueue.close();
  await cleanupWorker.close();
  await cleanupQueue.close();
  await streamManager.stopAll();
  // ...
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| aws-sdk v2 (monolithic) | @aws-sdk/client-s3 v3 (modular) | 2020+ | Tree-shakeable, smaller bundle, TypeScript-first |
| fluent-ffmpeg wrapper | Direct child_process.spawn | May 2025 (archived) | No dependency on unmaintained library; project already uses spawn |
| S3 presigned URL v2 signing | SigV4 via @aws-sdk/s3-request-presigner | Current | Required for R2 compatibility |

**Deprecated/outdated:**
- fluent-ffmpeg: Archived May 2025. Do not use.
- aws-sdk v2: AWS recommends v3 exclusively. v2 in maintenance mode.

## Open Questions

1. **Segment mtime accuracy under system clock drift**
   - What we know: mtime is set by the OS when FFmpeg finishes writing each segment. Under normal conditions, mtime tracks wall-clock time within milliseconds.
   - What's unclear: If the system clock drifts or NTP adjusts while recording, mtime could be inconsistent. This is unlikely on a properly configured server.
   - Recommendation: Accept mtime as reliable. The 10-second segment granularity means even a 1-second clock drift would not cause missed segments. If issues arise, add a safety margin (include adjacent segments).

2. **AudioSnippet model vs AirplayEvent.snippetUrl**
   - What we know: Schema has both an `AudioSnippet` model (with full metadata: sizeBytes, encoding, bitrate) AND `AirplayEvent.snippetUrl` field. CONTEXT.md says to store R2 key in `AirplayEvent.snippetUrl`.
   - What's unclear: Whether to also populate the AudioSnippet table or just use snippetUrl on AirplayEvent.
   - Recommendation: Use `AirplayEvent.snippetUrl` as the primary storage (per user decision). The `AudioSnippet` model can be populated as well for detailed metadata tracking (size, encoding info), but the presigned URL endpoint should read from `AirplayEvent.snippetUrl` for simplicity. The AudioSnippet table relationship is on Detection (not AirplayEvent), so it may be less relevant for the "one snippet per airplay event" model.

3. **R2 bucket CORS configuration**
   - What we know: CORS is only enforced by browsers, not native iOS apps.
   - What's unclear: Whether Phase 6 web dashboard will need CORS for audio playback.
   - Recommendation: Configure basic CORS rules now (allow GET from *) as a preventive measure. Low effort, prevents future issues.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.x |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `cd apps/api && pnpm test -- --run` |
| Full suite command | `cd apps/api && pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFR-03a | Segment resolver maps detection timestamp to correct segment files | unit | `cd apps/api && pnpm vitest run tests/lib/segment-resolver.test.ts -t "resolves segments"` | No -- Wave 0 |
| INFR-03b | FFmpeg extraction produces valid 5s AAC file | unit (mock spawn) | `cd apps/api && pnpm vitest run tests/workers/snippet.test.ts -t "extracts snippet"` | No -- Wave 0 |
| INFR-03c | Snippet worker skips when SNIPPETS_ENABLED is false | unit | `cd apps/api && pnpm vitest run tests/workers/snippet.test.ts -t "kill switch"` | No -- Wave 0 |
| INFR-03d | Snippet worker skips when segments unavailable | unit | `cd apps/api && pnpm vitest run tests/workers/snippet.test.ts -t "missing segments"` | No -- Wave 0 |
| INFR-03e | Detection worker enqueues snippet job for NEW airplay events only | unit | `cd apps/api && pnpm vitest run tests/workers/detection.test.ts -t "snippet"` | No -- Wave 0 (update existing) |
| INFR-04a | R2 client uploads file with correct key and content type | unit (mock SDK) | `cd apps/api && pnpm vitest run tests/lib/r2.test.ts -t "upload"` | No -- Wave 0 |
| INFR-04b | Presigned URL generated with 24h expiry | unit (mock SDK) | `cd apps/api && pnpm vitest run tests/lib/r2.test.ts -t "presign"` | No -- Wave 0 |
| INFR-04c | Snippet route returns presigned URL for valid airplay event | unit | `cd apps/api && pnpm vitest run tests/routes/airplay-events.test.ts -t "snippet URL"` | No -- Wave 0 |
| INFR-04d | Snippet route returns 404 when no snippet exists | unit | `cd apps/api && pnpm vitest run tests/routes/airplay-events.test.ts -t "no snippet"` | No -- Wave 0 |
| INFR-04e | AirplayEvent.snippetUrl updated after successful upload | unit | `cd apps/api && pnpm vitest run tests/workers/snippet.test.ts -t "updates snippetUrl"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/api && pnpm vitest run --reporter=verbose`
- **Per wave merge:** `cd apps/api && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/segment-resolver.test.ts` -- covers INFR-03a (segment timestamp resolution)
- [ ] `tests/lib/r2.test.ts` -- covers INFR-04a, INFR-04b (R2 upload + presign)
- [ ] `tests/workers/snippet.test.ts` -- covers INFR-03b, INFR-03c, INFR-03d, INFR-04e (snippet worker)
- [ ] `tests/routes/airplay-events.test.ts` -- covers INFR-04c, INFR-04d (snippet endpoint)
- [ ] Update `tests/workers/detection.test.ts` -- covers INFR-03e (snippet job enqueue)

## Sources

### Primary (HIGH confidence)
- [Cloudflare R2 AWS SDK v3 docs](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/) - S3Client setup, PutObject, GetObject examples
- [Cloudflare R2 Presigned URLs docs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) - Supported operations, expiry limits (1s-7d), limitations
- [FFmpeg documentation](https://ffmpeg.org/ffmpeg.html) - Seeking (-ss), duration (-t), concat protocol, AAC encoding
- [FFmpeg formats documentation](https://ffmpeg.org/ffmpeg-formats.html) - Concat demuxer, segment muxer, MPEG-TS handling
- [BullMQ concurrency docs](https://docs.bullmq.io/guide/workers/concurrency) - CPU-bound concurrency recommendations
- Project codebase: `detection.ts`, `cleanup.ts`, `ffmpeg.ts`, `supervisor/index.ts` - Established BullMQ and FFmpeg patterns

### Secondary (MEDIUM confidence)
- [@aws-sdk/client-s3 npm](https://www.npmjs.com/package/@aws-sdk/client-s3) - Latest version ~3.1009
- [@aws-sdk/s3-request-presigner npm](https://www.npmjs.com/package/@aws-sdk/s3-request-presigner) - Presigner companion package
- [BullMQ parallelism docs](https://docs.bullmq.io/guide/parallelism-and-concurrency) - CPU-bound: low concurrency, scale with workers

### Tertiary (LOW confidence)
- Segment mtime-based timestamp resolution approach -- logically sound based on FFmpeg segment muxer behavior, but not documented as an official pattern. Needs validation during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are official Cloudflare recommendations or already in the project
- Architecture: HIGH - Follows established project patterns (BullMQ worker lifecycle, Fastify routes, supervisor integration)
- Pitfalls: HIGH - Based on direct analysis of project code (cleanup worker timing, segment wrap behavior, detection worker structure)
- Segment resolution: MEDIUM - mtime-based approach is logically sound but custom; no off-the-shelf solution exists for this specific problem

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable technologies, 30-day validity)
