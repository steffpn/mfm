# Phase 4: Audio Snippet System - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Capture a 5-second audio clip from the ring buffer at the exact moment of each detection, encode it as AAC 128kbps, upload to Cloudflare R2, and make it available for playback via presigned URLs. Covers requirements INFR-03 (5s snippet capture) and INFR-04 (R2 storage with AAC encoding). User-facing playback UI is Phase 6. Authentication for the snippet endpoint is Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Snippet timing & positioning
- 5-second clip centered on the detection timestamp (2.5s before + 2.5s after the detection moment)
- Use the broadcast timestamp from the ACRCloud callback payload (not webhook arrival time) to find the right ring buffer segment
- One snippet per airplay event — first detection in an airplay event triggers snippet extraction, subsequent callbacks for the same play are skipped
- Best-effort, non-blocking — snippet job runs async via BullMQ; if extraction fails, the AirplayEvent is saved without a snippet (snippetUrl stays null)

### URL expiry & access strategy
- Store the R2 object key (not a presigned URL) in the `snippetUrl` field on AirplayEvent (e.g., `snippets/42/2026-03-15/789.aac`)
- Presigned URLs generated on demand with 24-hour expiry
- Dedicated API endpoint: `GET /api/v1/airplay-events/:id/snippet` returns a fresh presigned URL
- Authentication required to request a snippet URL (valid JWT) — the presigned URL itself works without auth (R2 serves directly)

### Snippet retention & storage
- Snippets kept indefinitely — no auto-deletion or retention policy
- R2 key pattern: `snippets/{stationId}/{YYYY-MM-DD}/{airplayEventId}.aac`
- Global kill switch via `SNIPPETS_ENABLED` environment variable (true/false) — when disabled, snippet jobs are skipped silently, detections still flow without audio capture
- Global toggle only (no per-station granularity for v1)

### Missing audio handling
- If ring buffer doesn't contain the required segment (too late, stream was down), skip silently — snippetUrl stays null on the airplay event
- No retry mechanism for missed snippets — the audio is gone once the ring buffer overwrites
- Target SLA: snippet should be available in R2 within 30 seconds of detection processing

### Claude's Discretion
- FFmpeg extraction command and segment-seeking logic
- BullMQ snippet worker concurrency (CPU-bound — balance speed vs system load)
- R2 client library and upload implementation
- Presigned URL generation approach (R2 SDK or S3-compatible API)
- Temporary file handling during extraction and encoding
- Error logging format and structured fields for monitoring
- Whether snippet worker runs as a separate process or co-located with detection worker

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Ring buffer segments** (data/streams/{stationId}/segment-NNN.ts): 10s MPEG-TS files, 20-segment wrap (~3.3 min retention). Snippet worker reads these.
- **Detection worker** (src/workers/detection.ts): Creates AirplayEvent records. Needs to emit a snippet extraction job when creating a new AirplayEvent (not when extending one).
- **Cleanup worker pattern** (src/workers/cleanup.ts): BullMQ worker lifecycle with Queue + Worker + graceful shutdown — reusable pattern for snippet worker.
- **AirplayEvent.snippetUrl** (schema.prisma): Nullable String field already exists, mapped to `snippet_url`. Will store R2 object key.
- **Redis client** (src/lib/redis.ts): Connection factory for BullMQ queues.
- **Pino logger**: Structured logging with context fields — use for snippet success/failure metrics.

### Established Patterns
- **BullMQ worker lifecycle**: Queue + Worker created in startXxxWorker() function, returned for graceful shutdown integration with supervisor
- **Supervisor integration**: Workers registered in supervisor index.ts with ordered shutdown sequence
- **Fastify route plugins**: routes/v1/{resource}/ with index.ts + schema.ts + handlers.ts
- **TypeBox validation**: Schema validation on request/response bodies

### Integration Points
- **Detection worker -> Snippet queue**: Detection worker enqueues a snippet extraction job when creating a new AirplayEvent (job data: airplayEventId, stationId, detectedAt timestamp)
- **Snippet worker -> Ring buffer**: Reads segment files from data/streams/{stationId}/ based on detection timestamp
- **Snippet worker -> R2**: Uploads encoded AAC file to Cloudflare R2
- **Snippet worker -> DB**: Updates AirplayEvent.snippetUrl with R2 object key after successful upload
- **Snippet API route -> R2**: Generates presigned URL from stored R2 key (auth-gated endpoint, Phase 5 adds JWT middleware)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-audio-snippet-system*
*Context gathered: 2026-03-15*
