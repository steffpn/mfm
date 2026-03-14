# Phase 2: Stream Recording Infrastructure - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

FFmpeg process supervisor that reliably records audio from 200+ radio/TV streams 24/7 with automatic failure recovery. Admin can manage stations via API. Covers requirements INFR-01 (24/7 monitoring), INFR-02 (admin station management), and INFR-05 (health monitoring with watchdog). Detection processing (Phase 3) and snippet extraction (Phase 4) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Ring buffer & audio format
- 3-minute rolling retention per stream (matches success criteria minimum)
- Disk-based rolling segment files (not in-memory)
- Per-station directory layout: `./data/streams/{station-id}/segment-NNN.ext`
- Hardcoded data directory: `./data/streams` relative to project root
- Separate BullMQ cleanup worker deletes segments older than 3 minutes (not FFmpeg-managed)
- Ring buffer directory mounted as Docker volume for persistence across container restarts

### Station lifecycle
- Recording starts immediately when admin adds a station via API (POST creates record + spawns FFmpeg)
- Soft delete only — station marked as 'inactive' (or 'deleted'), recording stops, DB record preserved
- Stream URL edit triggers stop-and-restart: kill current FFmpeg process, update URL, spawn new process (brief gap acceptable)
- Bulk import endpoint: POST /stations/bulk accepts JSON array for initial 200+ station setup

### Failure recovery & health
- 5 consecutive restart attempts with exponential backoff (e.g., 10s, 20s, 40s, 80s, 160s)
- After 5 failures, station marked as 'error' status — admin must manually re-enable
- Hang detection: if no new segment file modified within 30 seconds, stream considered hung and restarted
- Watchdog restarts hung or crashed streams within 60 seconds (success criteria)
- Persistent failures surfaced via station status field in API only (no proactive notifications in v1)

### Startup & scaling
- Staggered startup on system boot (batch streams, e.g., 10 at a time with short delay between batches)
- No hard limit on maximum concurrent streams — relies on infrastructure sizing
- Stream supervisor runs as a separate service/process from the Fastify API server
- API-to-supervisor coordination via Redis pub/sub (station:added, station:removed, station:updated events)

### Claude's Discretion
- Audio recording format and quality (raw pass-through vs re-encoding decision)
- FFmpeg command-line arguments and segment muxer configuration
- Exact cleanup worker interval and scheduling
- Staggered startup batch size and delay timing
- Supervisor service internal architecture (event loop, process tracking data structures)
- Exact exponential backoff timing values
- Segment file naming convention and rotation strategy

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Station model** (schema.prisma): Already has `status`, `lastHeartbeat`, `restartCount` fields — ready for health tracking
- **Redis client** (src/lib/redis.ts): Available for pub/sub and BullMQ job queues
- **Prisma client** (src/lib/prisma.ts): Ready for station CRUD operations
- **Fastify server** (src/index.ts): Set up with health check, plugin registration pattern for routes

### Established Patterns
- REST API with versioned routes under `/api/v1/` (commented placeholder in index.ts)
- BullMQ (Redis-backed) for async job processing (decided in Phase 1)
- Graceful shutdown handling already in place (SIGTERM/SIGINT)
- Vitest for testing with Docker-based integration tests

### Integration Points
- Station CRUD routes register as Fastify plugins under `/api/v1/stations`
- Supervisor service reads stations from same PostgreSQL database
- Redis pub/sub bridges API server and supervisor service
- Ring buffer files will be consumed by Phase 4 (snippet extraction) — file layout must be stable
- Station status/heartbeat updates written by supervisor, read by API for health endpoint

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-stream-recording-infrastructure*
*Context gathered: 2026-03-14*
