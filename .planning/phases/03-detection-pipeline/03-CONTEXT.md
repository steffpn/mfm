# Phase 3: Detection Pipeline - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

ACRCloud detection results flow into the system via webhook, are deduplicated into meaningful airplay events, and stored with full metadata. Covers requirements DETC-01 (webhook receiver), DETC-02 (detection storage with full metadata), and DETC-03 (gap-tolerance deduplication). Audio snippet extraction (Phase 4) and user-facing detection queries (Phase 6) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Webhook security
- Shared secret header for authentication (X-ACR-Secret or similar — configured in ACRCloud webhook settings)
- Failed auth returns 200 OK + silently drops the payload (prevents attackers from confirming endpoint exists)
- Strict schema validation on callback payload using Fastify+TypeBox (reject malformed payloads)

### Processing architecture
- Immediate 200 acknowledgment on valid webhook receipt — no timeouts from ACRCloud
- Actual processing (storage, deduplication) happens async via BullMQ job queue
- Webhook handler enqueues raw callback to BullMQ, worker processes it

### Deduplication strategy
- Real-time aggregation as each callback is processed (not periodic batch)
- Gap tolerance: 5 minutes (DETECTION_GAP_TOLERANCE_MS = 300000, already defined)
- Match key: ISRC first when available (globally unique song ID), fallback to normalized title+artist when ISRC is null
- Metadata selection: highest-confidence callback's metadata (title, artist, album) wins for the airplay event
- No minimum confidence threshold — store all detections, apply confidence filters at query time (dashboard, reports)

### No-match handling
- No-match callbacks (silence, speech, jingles) stored in a separate lightweight table
- Summary only: station ID, timestamp, callback type/status — not full ACRCloud payload
- 7-day retention with auto-cleanup via scheduled BullMQ job
- Passive health signal: track last successful detection per station; extended no-match-only periods surface in station health

### Station mapping
- `acrcloudStreamId` column added to Station model (required, unique constraint, 1:1 mapping)
- Webhook lookup: find station by ACRCloud stream ID in callback payload
- Unknown stream IDs: log warning and discard the callback (no quarantine or storage)
- ACRCloud stream ID required when creating a station — every station must have ACRCloud monitoring configured

### Claude's Discretion
- BullMQ queue names, concurrency settings, and retry policies
- Exact ACRCloud payload field mapping (depends on their API structure — researcher will investigate)
- No-match cleanup job scheduling interval
- Title/artist normalization algorithm for fallback matching
- Whether to use a dedicated BullMQ worker process or co-locate with existing cleanup worker
- Database transaction strategy for detection + airplay event upserts

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Detection model** (schema.prisma): Full schema with composite PK (id, detectedAt), indexes on station+time, artist+time, ISRC
- **AirplayEvent model** (schema.prisma): Schema with playCount, startedAt/endedAt, snippetUrl placeholder
- **DetectionStatus enum** (packages/shared): RAW/AGGREGATED statuses ready for use
- **DETECTION_GAP_TOLERANCE_MS** (packages/shared/constants): 5-minute gap tolerance already defined
- **DetectionEvent/AirplayEvent types** (packages/shared/types): Full TypeScript interfaces for create and read operations
- **BullMQ cleanup worker** (workers/cleanup.ts): Pattern for BullMQ worker with scheduled jobs — reusable pattern
- **Redis client** (lib/redis.ts): Connection already configured for BullMQ
- **Pub/sub module** (lib/pubsub.ts): Redis pub/sub for inter-service events

### Established Patterns
- **Fastify route plugin pattern**: routes/v1/{resource}/ with index.ts + schema.ts + handlers.ts (from station routes)
- **TypeBox validation**: Schema validation on request bodies (used in station CRUD)
- **BullMQ job processing**: Worker lifecycle tied to service startup/shutdown (cleanup worker pattern)
- **Pino logging**: Structured logging with station/stream context

### Integration Points
- Webhook route registers as Fastify plugin under `/api/v1/webhooks/acrcloud` or similar
- Detection worker reads from BullMQ queue, writes to Detection + AirplayEvent tables via Prisma
- Station lookup by acrcloudStreamId requires schema migration to add column
- No-match health signal integrates with existing station status/heartbeat fields
- Phase 4 (snippets) will trigger from detection events — detection processing should emit an event/job for snippet extraction

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-detection-pipeline*
*Context gathered: 2026-03-15*
