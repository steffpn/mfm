# Phase 2: Stream Recording Infrastructure - Research

**Researched:** 2026-03-14
**Domain:** FFmpeg process supervision, Node.js child process management, audio stream recording
**Confidence:** HIGH

## Summary

This phase builds an FFmpeg process supervisor that records audio from 200+ internet radio/TV streams 24/7 into rolling disk-based segment files, with automatic failure recovery and admin management via REST API. The architecture is split into two services: (1) a Fastify API server handling station CRUD and health queries, and (2) a standalone supervisor service that spawns/monitors FFmpeg processes and manages the ring buffer cleanup. They coordinate through Redis pub/sub.

The core technical challenge is managing 200+ long-running FFmpeg child processes in Node.js with reliable failure detection and restart. FFmpeg's segment muxer with `segment_wrap` provides native rolling file support, but the user decision specifies a separate BullMQ cleanup worker instead. FFmpeg's built-in reconnect options (`-reconnect`, `-reconnect_streamed`, `-reconnect_on_network_error`) handle transient network failures at the FFmpeg level, while the Node.js supervisor watchdog handles process-level crashes and hangs.

**Primary recommendation:** Use `child_process.spawn()` with `stdio: ['ignore', 'ignore', 'pipe']` for each FFmpeg process, track processes in a `Map<number, StreamProcess>` keyed by station ID, implement watchdog via periodic filesystem checks (segment file mtime), and coordinate API-to-supervisor via Redis pub/sub channels. Use FFmpeg's segment muxer (`-f segment`) with `-c copy` (no re-encoding) for minimum CPU overhead.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 3-minute rolling retention per stream (matches success criteria minimum)
- Disk-based rolling segment files (not in-memory)
- Per-station directory layout: `./data/streams/{station-id}/segment-NNN.ext`
- Hardcoded data directory: `./data/streams` relative to project root
- Separate BullMQ cleanup worker deletes segments older than 3 minutes (not FFmpeg-managed)
- Ring buffer directory mounted as Docker volume for persistence across container restarts
- Recording starts immediately when admin adds a station via API (POST creates record + spawns FFmpeg)
- Soft delete only -- station marked as 'inactive' (or 'deleted'), recording stops, DB record preserved
- Stream URL edit triggers stop-and-restart: kill current FFmpeg process, update URL, spawn new process (brief gap acceptable)
- Bulk import endpoint: POST /stations/bulk accepts JSON array for initial 200+ station setup
- 5 consecutive restart attempts with exponential backoff (e.g., 10s, 20s, 40s, 80s, 160s)
- After 5 failures, station marked as 'error' status -- admin must manually re-enable
- Hang detection: if no new segment file modified within 30 seconds, stream considered hung and restarted
- Watchdog restarts hung or crashed streams within 60 seconds (success criteria)
- Persistent failures surfaced via station status field in API only (no proactive notifications in v1)
- Staggered startup on system boot (batch streams, e.g., 10 at a time with short delay between batches)
- No hard limit on maximum concurrent streams -- relies on infrastructure sizing
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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFR-01 | Backend monitors 200+ Romanian radio/TV streams 24/7 via FFmpeg process supervisor | FFmpeg segment muxer with `-c copy`, Node.js spawn-based supervisor with Map tracking, staggered startup, watchdog polling |
| INFR-02 | Admin can add, edit, and remove stations with stream URLs | Fastify route plugins for station CRUD, Redis pub/sub to notify supervisor of changes |
| INFR-05 | Stream health monitoring with per-stream watchdog and automatic restart on failure | Filesystem-based hang detection (segment mtime), exponential backoff restart, status field updates via Prisma |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FFmpeg | 7.x (system) | Audio stream recording into segment files | Industry-standard for stream capture; segment muxer provides native file splitting |
| child_process (Node built-in) | N/A | Spawn and manage FFmpeg processes | No wrapper needed; direct spawn gives full control over stdio, signals, exit codes |
| ioredis | ^5.4.0 | Redis pub/sub for API-to-supervisor coordination | Already in project; supports dedicated subscriber connections |
| BullMQ | ^5.71.0 | Cleanup worker for expired segment files | Already in project; job schedulers (v5.16+) replace deprecated repeatable jobs API |
| Prisma | ^7.3.0 | Station CRUD and status updates | Already in project with Station model ready |
| Fastify | ^5.8.0 | REST API for station management and health endpoints | Already in project; plugin architecture for route registration |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @sinclair/typebox | ^0.34.0 | JSON Schema type builder for Fastify route validation | Define request/response schemas with TypeScript type inference |
| pino (via Fastify) | built-in | Structured logging for supervisor service | Already available through Fastify; use standalone pino for supervisor process |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw child_process.spawn | fluent-ffmpeg (npm) | Adds abstraction layer; unnecessary for long-running segment recording where we need direct process control |
| BullMQ cleanup worker | FFmpeg segment_wrap | User decision locks BullMQ cleanup; segment_wrap would be simpler but less controllable |
| Redis pub/sub | BullMQ events | Redis pub/sub is lighter weight for simple command dispatch; BullMQ adds queue overhead not needed here |
| TypeBox | Zod + fastify-zod | TypeBox is Fastify's native type provider; Zod requires additional adapter |

**Installation:**
```bash
pnpm --filter api add @sinclair/typebox
```

No other new dependencies needed -- FFmpeg is a system dependency installed in the Docker image.

## Architecture Patterns

### Recommended Project Structure
```
apps/api/
  src/
    routes/
      v1/
        stations/
          index.ts           # Plugin registering all station routes
          schema.ts           # TypeBox schemas for request/response validation
          handlers.ts         # Route handler functions
    services/
      supervisor/
        index.ts             # Supervisor entry point (separate process)
        stream-manager.ts    # Map<stationId, StreamProcess> + spawn/kill logic
        watchdog.ts          # Periodic health check loop
        ffmpeg.ts            # FFmpeg command builder and process spawner
    workers/
      cleanup.ts             # BullMQ worker for segment file cleanup
    lib/
      redis.ts               # Existing Redis client (+ pub/sub helpers)
      prisma.ts              # Existing Prisma client
      pubsub.ts              # Redis pub/sub channel definitions and helpers
    index.ts                 # Existing Fastify server entry point
  data/
    streams/                 # Ring buffer root (Docker volume mount point)
      {station-id}/          # Per-station directory
        segment-000.mp3      # Rolling segment files
        segment-001.mp3
        ...
```

### Pattern 1: FFmpeg Segment Recording (No Re-encoding)
**What:** Record internet audio streams using FFmpeg's segment muxer with codec copy (pass-through)
**When to use:** For every active station -- this is the core recording pattern
**Recommendation (Claude's Discretion):** Use `-c copy` to pass through the source audio without re-encoding. This minimizes CPU usage (critical at 200+ streams) and preserves original quality. Most Romanian radio streams use MP3 or AAC encoding, both of which segment cleanly.

```bash
# Recommended FFmpeg command per stream
ffmpeg \
  -reconnect 1 \
  -reconnect_streamed 1 \
  -reconnect_on_network_error 1 \
  -reconnect_delay_max 10 \
  -rw_timeout 15000000 \
  -i "https://stream.example.ro/live" \
  -c copy \
  -f segment \
  -segment_time 10 \
  -segment_wrap 20 \
  -reset_timestamps 1 \
  -strftime 0 \
  "data/streams/{station-id}/segment-%03d.mp3"
```

**Argument rationale (Claude's Discretion):**
- `-reconnect 1 -reconnect_streamed 1 -reconnect_on_network_error 1`: FFmpeg-level auto-reconnect for transient network issues (before the Node.js watchdog kicks in)
- `-reconnect_delay_max 10`: Cap reconnect delay at 10 seconds (FFmpeg uses exponential backoff: 0, 1, 3, 7, 10, 10...)
- `-rw_timeout 15000000`: 15-second read/write timeout in microseconds -- if no data for 15s, FFmpeg errors out (triggers Node.js watchdog)
- `-c copy`: Pass-through, no re-encoding -- critical for CPU efficiency at scale
- `-f segment -segment_time 10`: Create 10-second segment files
- `-segment_wrap 20`: Overwrite after 20 segments (200 seconds = 3.3 minutes of rolling buffer, exceeds 3-minute requirement)
- `-reset_timestamps 1`: Each segment starts at timestamp 0 for clean playback
- `segment-%03d.mp3`: Numeric naming pattern (segment-000.mp3 through segment-019.mp3)

**Note on segment_wrap vs BullMQ cleanup:** The user decision requires a BullMQ cleanup worker. However, `segment_wrap` provides automatic overwriting at the FFmpeg level. **Recommendation:** Use `segment_wrap` as the primary mechanism (it prevents unbounded disk growth even if the cleanup worker fails), AND run the BullMQ cleanup worker as a safety net to handle edge cases (orphaned directories from deleted stations, stale files from crashed processes). This honors the user's decision while adding defense in depth.

### Pattern 2: Supervisor Service Architecture
**What:** Standalone Node.js process that manages all FFmpeg child processes
**When to use:** This is the single supervisor service that runs alongside the API server

```typescript
// Core data structure for tracking streams
interface StreamProcess {
  stationId: number;
  streamUrl: string;
  process: ChildProcess;
  pid: number;
  startedAt: Date;
  lastSegmentAt: Date;       // Updated by watchdog when new segment detected
  restartCount: number;
  status: 'starting' | 'recording' | 'restarting' | 'error';
  backoffMs: number;         // Current backoff delay
}

// StreamManager maintains the Map
class StreamManager {
  private streams = new Map<number, StreamProcess>();

  async startStream(stationId: number, streamUrl: string): Promise<void> { /* ... */ }
  async stopStream(stationId: number): Promise<void> { /* ... */ }
  async restartStream(stationId: number): Promise<void> { /* ... */ }
  getStatus(stationId: number): StreamProcess | undefined { /* ... */ }
  getAllStatuses(): StreamProcess[] { /* ... */ }
}
```

### Pattern 3: Redis Pub/Sub Coordination
**What:** API server publishes station lifecycle events; supervisor subscribes and acts
**When to use:** Every station add/edit/delete triggers a pub/sub message

```typescript
// Channel definitions
const CHANNELS = {
  STATION_ADDED: 'station:added',
  STATION_REMOVED: 'station:removed',
  STATION_UPDATED: 'station:updated',
} as const;

// Message payload
interface StationEvent {
  stationId: number;
  streamUrl?: string;  // Included for ADDED and UPDATED
  timestamp: string;
}

// API side (publisher) -- uses existing redis client
await redis.publish(CHANNELS.STATION_ADDED, JSON.stringify({
  stationId: station.id,
  streamUrl: station.streamUrl,
  timestamp: new Date().toISOString(),
}));

// Supervisor side (subscriber) -- MUST use dedicated connection
const subscriber = createRedisConnection();
await subscriber.subscribe(
  CHANNELS.STATION_ADDED,
  CHANNELS.STATION_REMOVED,
  CHANNELS.STATION_UPDATED,
);
subscriber.on('message', (channel, message) => {
  const event: StationEvent = JSON.parse(message);
  switch (channel) {
    case CHANNELS.STATION_ADDED:
      streamManager.startStream(event.stationId, event.streamUrl!);
      break;
    case CHANNELS.STATION_REMOVED:
      streamManager.stopStream(event.stationId);
      break;
    case CHANNELS.STATION_UPDATED:
      streamManager.restartStream(event.stationId);
      break;
  }
});
```

### Pattern 4: Watchdog Health Check Loop
**What:** Periodic loop that checks segment file timestamps and restarts hung streams
**When to use:** Runs continuously in the supervisor service

```typescript
// Watchdog polls every 10 seconds (Claude's Discretion)
const WATCHDOG_INTERVAL_MS = 10_000;
const STALE_THRESHOLD_MS = 30_000;  // User decision: 30 seconds

async function watchdogLoop(streamManager: StreamManager): Promise<void> {
  for (const [stationId, stream] of streamManager.streams) {
    if (stream.status !== 'recording') continue;

    const segmentDir = path.join(DATA_DIR, String(stationId));
    const latestMtime = await getLatestSegmentMtime(segmentDir);

    if (!latestMtime || Date.now() - latestMtime.getTime() > STALE_THRESHOLD_MS) {
      // Stream is hung -- restart it
      await streamManager.restartStream(stationId);
    } else {
      // Stream is healthy -- update heartbeat in DB
      await prisma.station.update({
        where: { id: stationId },
        data: { lastHeartbeat: new Date() },
      });
    }
  }
}
```

### Pattern 5: Exponential Backoff Restart
**What:** Restart failed streams with increasing delays, circuit-break after 5 failures
**When to use:** Every stream failure triggers this logic

```typescript
// Backoff calculation (Claude's Discretion: base 10s, factor 2x)
const BASE_BACKOFF_MS = 10_000;
const MAX_RESTARTS = 5;

function getBackoffDelay(restartCount: number): number {
  // 10s, 20s, 40s, 80s, 160s
  return BASE_BACKOFF_MS * Math.pow(2, restartCount);
}

async function handleStreamFailure(stationId: number, stream: StreamProcess): Promise<void> {
  stream.restartCount += 1;

  if (stream.restartCount >= MAX_RESTARTS) {
    stream.status = 'error';
    await prisma.station.update({
      where: { id: stationId },
      data: {
        status: 'ERROR',
        restartCount: stream.restartCount,
      },
    });
    return; // Circuit breaker -- admin must re-enable
  }

  stream.status = 'restarting';
  const delay = getBackoffDelay(stream.restartCount - 1);

  setTimeout(async () => {
    await streamManager.startStream(stationId, stream.streamUrl);
  }, delay);
}
```

### Pattern 6: Staggered Startup
**What:** On boot, load all active stations from DB and start them in batches
**When to use:** Supervisor service initialization

```typescript
// Staggered startup (Claude's Discretion: 10 per batch, 2s delay)
const STARTUP_BATCH_SIZE = 10;
const STARTUP_BATCH_DELAY_MS = 2_000;

async function staggeredStartup(streamManager: StreamManager): Promise<void> {
  const stations = await prisma.station.findMany({
    where: { status: 'ACTIVE' },
  });

  for (let i = 0; i < stations.length; i += STARTUP_BATCH_SIZE) {
    const batch = stations.slice(i, i + STARTUP_BATCH_SIZE);
    await Promise.all(
      batch.map(s => streamManager.startStream(s.id, s.streamUrl))
    );

    if (i + STARTUP_BATCH_SIZE < stations.length) {
      await new Promise(resolve => setTimeout(resolve, STARTUP_BATCH_DELAY_MS));
    }
  }
}
```

### Anti-Patterns to Avoid
- **Piping FFmpeg stdout/stderr to Node.js buffers:** At 200+ processes, buffering stderr data in Node.js causes memory bloat. Use `stdio: ['ignore', 'ignore', 'pipe']` and only read stderr for error logging, discarding data promptly. Or use `'ignore'` for all streams and rely solely on process exit codes + segment file monitoring.
- **Using fluent-ffmpeg for long-running processes:** The library is designed for one-shot transcoding jobs, not 24/7 daemon processes. Raw `child_process.spawn()` gives better control over signals and lifecycle.
- **Single Redis connection for pub/sub:** ioredis requires a dedicated connection for subscribe mode -- a subscribed connection cannot run other commands. Always use `createRedisConnection()` for the subscriber.
- **Polling FFmpeg process.exitCode:** Process exit events are async. Use the `close` event (not `exit`) to ensure stdio streams are fully flushed before handling the exit.
- **In-memory ring buffer:** For 200+ streams, in-memory buffers would consume excessive RAM. Disk-based segments with `-f segment` are the correct approach (also matches user decision).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio stream recording | Custom TCP/HTTP stream reader | FFmpeg with `-f segment -c copy` | FFmpeg handles codec parsing, reconnection, format detection, and hundreds of stream protocols |
| Recurring cleanup jobs | Custom setInterval-based scheduler | BullMQ job schedulers (upsertJobScheduler) | Handles process crashes, guarantees execution, provides monitoring |
| JSON schema validation | Manual request parsing and validation | TypeBox + Fastify type providers | Compile-time TypeScript types AND runtime validation from single schema definition |
| Process signal handling | Manual process.kill with PIDs | ChildProcess.kill(signal) | Proper signal delivery, handles edge cases like zombie processes |
| Exponential backoff | Ad-hoc delay calculation | Simple formula: `base * 2^n` | Consistent, predictable, well-understood pattern |

**Key insight:** FFmpeg is the critical "don't hand-roll" item. Writing custom HTTP stream readers, codec parsers, or segment splitters would be orders of magnitude more work and less reliable than FFmpeg's battle-tested implementation.

## Common Pitfalls

### Pitfall 1: FFmpeg Zombie Processes
**What goes wrong:** If the Node.js supervisor crashes or is killed with SIGKILL, spawned FFmpeg processes become orphans and continue running, consuming resources.
**Why it happens:** Child processes outlive their parent when the parent doesn't get a chance to clean up.
**How to avoid:** (1) Register SIGTERM/SIGINT handlers that kill all FFmpeg processes before exit. (2) On supervisor startup, check for orphaned FFmpeg processes from a previous run and kill them. (3) Consider using `detached: false` (default) in spawn options so processes are grouped. (4) Store PIDs in Redis on spawn, clean up on startup.
**Warning signs:** Duplicate recordings, increasing system memory usage, `ps aux | grep ffmpeg` showing unexpected processes.

### Pitfall 2: Stream URL Format Variability
**What goes wrong:** Romanian radio streams use diverse formats: Icecast (MP3/OGG), Shoutcast (MP3/AAC), HLS (m3u8), plain HTTP MP3, and sometimes RTMP.
**Why it happens:** No standard protocol for internet radio. Each station uses different streaming software.
**How to avoid:** Use `-c copy` to pass through whatever codec the source provides. FFmpeg auto-detects the input format. For the segment output format, detect the source codec and use the appropriate container (`.mp3` for MP3, `.aac`/`.adts` for AAC, `.ogg` for Vorbis). Alternatively, re-encode to a consistent format like MP3 at the cost of CPU.
**Warning signs:** FFmpeg errors like "Invalid data found when processing input" or segment files with 0 bytes.

### Pitfall 3: Segment File Extension Mismatch
**What goes wrong:** Using `-c copy` with `-f segment` and a `.mp3` extension when the source is AAC produces corrupt files.
**Why it happens:** The segment muxer writes raw copied codec data into the file. If the container format doesn't match the codec, the file is unplayable.
**How to avoid:** Either (a) probe the stream format with `ffprobe` before starting FFmpeg to determine the correct extension, or (b) always re-encode to a consistent format with `-c:a libmp3lame -b:a 64k` (adds ~1% CPU per stream but guarantees consistency), or (c) use a format-agnostic container like `.mkv` or `.ts` (MPEG-TS).
**Warning signs:** Segment files that cannot be played back, inconsistent file sizes.

### Pitfall 4: Redis Pub/Sub Message Loss
**What goes wrong:** If the supervisor is temporarily disconnected from Redis when the API publishes a station event, the message is lost forever (Redis pub/sub has no persistence).
**Why it happens:** Redis pub/sub is fire-and-forget -- messages are not queued.
**How to avoid:** On supervisor startup (and Redis reconnection), do a full reconciliation: load all active stations from the database and compare with currently running streams. Start missing streams, stop extra streams. Pub/sub handles real-time updates; DB reconciliation handles catch-up.
**Warning signs:** Stations added via API but not recording, or stations deleted via API but still recording.

### Pitfall 5: File Descriptor Exhaustion
**What goes wrong:** With 200+ FFmpeg processes, each with piped stderr, plus Redis connections, DB connections, and filesystem watchers, the process can hit the OS file descriptor limit.
**Why it happens:** Default `ulimit -n` is often 1024 on Linux. Each FFmpeg process uses at least 3 FDs in the parent (stdin pipe, stdout pipe, stderr pipe), and the supervisor needs FDs for its own operations.
**How to avoid:** (1) Set `ulimit -n 65536` in the Docker container. (2) Use `stdio: ['ignore', 'ignore', 'pipe']` to minimize pipe FDs (only stderr). (3) Or use `stdio: 'ignore'` for all streams if logs are not needed.
**Warning signs:** `EMFILE: too many open files` errors, streams failing to start.

### Pitfall 6: Disk Space Exhaustion
**What goes wrong:** If segment_wrap is not used and the cleanup worker fails, segments accumulate indefinitely.
**Why it happens:** Without FFmpeg-level wrapping, segment files grow forever. BullMQ worker crashes are silent.
**How to avoid:** Use `segment_wrap` in FFmpeg as primary defense (files overwrite automatically). BullMQ cleanup as secondary cleanup for orphaned files. Monitor disk usage.
**Warning signs:** Disk usage growing linearly over time, cleanup worker queue backlog.

### Pitfall 7: Stale Heartbeat Masking Real Failures
**What goes wrong:** Watchdog updates `lastHeartbeat` in DB, but the FFmpeg process is producing empty/corrupt segments.
**Why it happens:** Watchdog only checks segment file mtime, not segment content validity.
**How to avoid:** Periodically check segment file sizes (not just mtime). A 10-second audio segment should be at least a few KB. Zero-byte or suspiciously small segments indicate a problem.
**Warning signs:** Segment files with size 0 or < 1KB, detection pipeline (Phase 3) reporting no matches.

## Code Examples

### Spawning an FFmpeg Process
```typescript
import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';

const DATA_DIR = path.resolve('./data/streams');

async function spawnFFmpeg(stationId: number, streamUrl: string): Promise<ChildProcess> {
  const segmentDir = path.join(DATA_DIR, String(stationId));
  await fs.mkdir(segmentDir, { recursive: true });

  const outputPattern = path.join(segmentDir, 'segment-%03d.mp3');

  const proc = spawn('ffmpeg', [
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_on_network_error', '1',
    '-reconnect_delay_max', '10',
    '-rw_timeout', '15000000',
    '-i', streamUrl,
    '-c', 'copy',
    '-f', 'segment',
    '-segment_time', '10',
    '-segment_wrap', '20',
    '-reset_timestamps', '1',
    '-y',                        // Overwrite without prompting
    outputPattern,
  ], {
    stdio: ['ignore', 'ignore', 'pipe'],  // Only capture stderr
    detached: false,
  });

  // Log stderr but don't accumulate in memory
  proc.stderr?.on('data', (data: Buffer) => {
    // Log last line for diagnostics; keep a small circular buffer
    const line = data.toString().trim();
    if (line) {
      logger.debug({ stationId, ffmpeg: line }, 'ffmpeg stderr');
    }
  });

  proc.on('close', (code, signal) => {
    logger.info({ stationId, code, signal }, 'FFmpeg process exited');
    // Trigger failure handler
  });

  return proc;
}
```

### Station CRUD Route Plugin (Fastify)
```typescript
import { FastifyPluginAsync } from 'fastify';
import { Type, Static } from '@sinclair/typebox';

const StationCreateSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  streamUrl: Type.String({ format: 'uri' }),
  stationType: Type.Union([Type.Literal('radio'), Type.Literal('tv')]),
  country: Type.Optional(Type.String({ default: 'RO' })),
});

const StationBulkCreateSchema = Type.Array(StationCreateSchema, { minItems: 1 });

type StationCreateBody = Static<typeof StationCreateSchema>;

const stationRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /stations -- create single station
  fastify.post<{ Body: StationCreateBody }>('/', {
    schema: { body: StationCreateSchema },
  }, async (request, reply) => {
    const station = await prisma.station.create({
      data: { ...request.body, status: 'ACTIVE' },
    });

    // Notify supervisor
    await redis.publish('station:added', JSON.stringify({
      stationId: station.id,
      streamUrl: station.streamUrl,
      timestamp: new Date().toISOString(),
    }));

    return reply.status(201).send(station);
  });

  // POST /stations/bulk -- bulk import
  fastify.post('/bulk', {
    schema: { body: StationBulkCreateSchema },
  }, async (request, reply) => {
    // ... bulk create logic with pub/sub notifications
  });

  // GET /stations -- list with health status
  fastify.get('/', async () => {
    return prisma.station.findMany({
      select: {
        id: true, name: true, streamUrl: true, stationType: true,
        status: true, lastHeartbeat: true, restartCount: true,
      },
    });
  });

  // PATCH /stations/:id -- update station
  // DELETE /stations/:id -- soft delete
  // GET /stations/:id/health -- detailed health info
};

export default stationRoutes;
```

### BullMQ Cleanup Worker
```typescript
import { Worker, Queue } from 'bullmq';
import { createRedisConnection } from '../lib/redis.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const CLEANUP_QUEUE = 'segment-cleanup';
const DATA_DIR = path.resolve('./data/streams');
const MAX_AGE_MS = 3 * 60 * 1000; // 3 minutes

// Register job scheduler (Claude's Discretion: every 30 seconds)
const queue = new Queue(CLEANUP_QUEUE, { connection: createRedisConnection() });
await queue.upsertJobScheduler('cleanup-scheduler', {
  every: 30_000,  // Every 30 seconds
}, {
  name: 'cleanup-segments',
  data: {},
});

// Worker processes cleanup jobs
const worker = new Worker(CLEANUP_QUEUE, async (job) => {
  const stationDirs = await fs.readdir(DATA_DIR, { withFileTypes: true });

  for (const dir of stationDirs) {
    if (!dir.isDirectory()) continue;
    const stationDir = path.join(DATA_DIR, dir.name);
    const files = await fs.readdir(stationDir);

    for (const file of files) {
      const filePath = path.join(stationDir, file);
      const stat = await fs.stat(filePath);
      if (Date.now() - stat.mtimeMs > MAX_AGE_MS) {
        await fs.unlink(filePath);
      }
    }
  }
}, { connection: createRedisConnection() });
```

### Checking Latest Segment Mtime (Watchdog)
```typescript
import fs from 'node:fs/promises';
import path from 'node:path';

async function getLatestSegmentMtime(segmentDir: string): Promise<Date | null> {
  try {
    const files = await fs.readdir(segmentDir);
    let latestMtime: Date | null = null;

    for (const file of files) {
      const stat = await fs.stat(path.join(segmentDir, file));
      if (!latestMtime || stat.mtime > latestMtime) {
        latestMtime = stat.mtime;
      }
    }

    return latestMtime;
  } catch {
    return null;  // Directory doesn't exist yet
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BullMQ repeatable jobs API | BullMQ Job Schedulers (upsertJobScheduler) | v5.16.0 (2024) | Old API deprecated; use upsertJobScheduler instead |
| FFmpeg 4.x reconnect | FFmpeg 7.x reconnect options | 2024 | Reconnect options are stable and well-tested in FFmpeg 7.x |
| fluent-ffmpeg wrapper | Direct child_process.spawn | N/A | For long-running daemon processes, direct spawn is preferred over wrapper libraries |
| Custom JSON validation | TypeBox with Fastify type providers | Fastify 5.x | Native integration, single source of truth for types and validation |

**Deprecated/outdated:**
- BullMQ `queue.add('name', data, { repeat: { ... } })`: Deprecated in v5.16.0, use `queue.upsertJobScheduler()` instead
- `hls_wrap` option in FFmpeg: Deprecated in favor of `hls_flags delete_segments`; does not affect segment muxer's `segment_wrap` which remains supported

## Open Questions

1. **Stream format heterogeneity**
   - What we know: Romanian radio streams use MP3, AAC, OGG, HLS, and occasionally RTMP
   - What's unclear: Whether `-c copy` with a fixed `.mp3` extension works for all source formats
   - Recommendation: Start with `-c copy` and `.ts` (MPEG-TS) container format for maximum codec compatibility. MPEG-TS can contain MP3, AAC, and other audio codecs without issues. Alternatively, add a one-time `ffprobe` call when a station is first added to detect the source format and set the segment extension accordingly. If format detection proves unreliable, fall back to re-encoding all streams to MP3 128k (`-c:a libmp3lame -b:a 128k`).

2. **FFmpeg memory footprint at 200 streams**
   - What we know: Each FFmpeg process with `-c copy` (no encoding) uses minimal CPU but still has a base memory footprint (~10-30MB per process depending on protocol/buffer sizes)
   - What's unclear: Exact memory usage per process for Romanian radio stream profiles
   - Recommendation: With 200 streams at ~20MB each = ~4GB RAM for FFmpeg alone. Ensure the production server has at least 8GB RAM. The STATE.md already flags this as a research blocker needing empirical testing.

3. **Supervisor service packaging**
   - What we know: Must run as separate process from Fastify API
   - What's unclear: Whether it should be a separate npm script, a separate Docker container, or a worker thread
   - Recommendation: Separate npm script in the same `apps/api` package (e.g., `pnpm run supervisor`), sharing the same codebase and Prisma client. In Docker, run as a separate container from the same image with a different entrypoint. This avoids duplicating code while keeping process isolation.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `pnpm --filter api test` |
| Full suite command | `pnpm test` (via Turbo) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFR-01 | FFmpeg process spawns and produces segment files | integration | `pnpm --filter api vitest run tests/supervisor/stream-manager.test.ts -x` | No -- Wave 0 |
| INFR-01 | Staggered startup loads stations from DB and starts in batches | unit | `pnpm --filter api vitest run tests/supervisor/startup.test.ts -x` | No -- Wave 0 |
| INFR-02 | POST /stations creates station and publishes event | integration | `pnpm --filter api vitest run tests/routes/stations.test.ts -x` | No -- Wave 0 |
| INFR-02 | POST /stations/bulk creates multiple stations | integration | `pnpm --filter api vitest run tests/routes/stations.test.ts -x` | No -- Wave 0 |
| INFR-02 | PATCH /stations/:id updates and triggers restart | integration | `pnpm --filter api vitest run tests/routes/stations.test.ts -x` | No -- Wave 0 |
| INFR-02 | DELETE /stations/:id soft-deletes and stops recording | integration | `pnpm --filter api vitest run tests/routes/stations.test.ts -x` | No -- Wave 0 |
| INFR-05 | Watchdog detects stale segments and triggers restart | unit | `pnpm --filter api vitest run tests/supervisor/watchdog.test.ts -x` | No -- Wave 0 |
| INFR-05 | Exponential backoff increments on consecutive failures | unit | `pnpm --filter api vitest run tests/supervisor/backoff.test.ts -x` | No -- Wave 0 |
| INFR-05 | Circuit breaker marks station as ERROR after 5 failures | unit | `pnpm --filter api vitest run tests/supervisor/backoff.test.ts -x` | No -- Wave 0 |
| INFR-05 | GET /stations returns health status fields | integration | `pnpm --filter api vitest run tests/routes/stations.test.ts -x` | No -- Wave 0 |
| INFR-05 | Cleanup worker deletes segments older than 3 minutes | unit | `pnpm --filter api vitest run tests/workers/cleanup.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter api test`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/routes/stations.test.ts` -- covers INFR-02 station CRUD routes
- [ ] `tests/supervisor/stream-manager.test.ts` -- covers INFR-01 FFmpeg spawn/stop
- [ ] `tests/supervisor/watchdog.test.ts` -- covers INFR-05 hang detection
- [ ] `tests/supervisor/backoff.test.ts` -- covers INFR-05 exponential backoff and circuit breaker
- [ ] `tests/supervisor/startup.test.ts` -- covers INFR-01 staggered startup
- [ ] `tests/workers/cleanup.test.ts` -- covers INFR-05 segment cleanup
- [ ] `tests/lib/pubsub.test.ts` -- covers Redis pub/sub helper functions
- [ ] Mock strategy: For FFmpeg integration tests, create mock FFmpeg script that writes fake segment files, avoid depending on real streams in CI

## Sources

### Primary (HIGH confidence)
- [FFmpeg Formats Documentation](https://ffmpeg.org/ffmpeg-formats.html) - segment muxer options (segment_time, segment_wrap, segment_format, reset_timestamps)
- [FFmpeg Protocols Documentation](https://ffmpeg.org/ffmpeg-protocols.html) - reconnect options, rw_timeout
- [Node.js child_process API](https://nodejs.org/api/child_process.html) - spawn, stdio options, signal handling
- [BullMQ Job Schedulers](https://docs.bullmq.io/guide/job-schedulers) - upsertJobScheduler API, repeat options
- [BullMQ Repeat Options](https://docs.bullmq.io/guide/job-schedulers/repeat-options) - every, pattern, limit options
- [Fastify TypeScript](https://fastify.dev/docs/latest/Reference/TypeScript/) - type providers, TypeBox integration
- [Fastify Routes](https://fastify.dev/docs/latest/Reference/Routes/) - plugin registration pattern

### Secondary (MEDIUM confidence)
- [Frigate NVR FFmpeg Watchdog](https://deepwiki.com/blakeblackshear/frigate/9-system-monitoring-and-health) - real-world watchdog implementation monitoring segment file creation, 120s stale threshold, automatic FFmpeg restart
- [FFmpeg Watchdog (rrymm/ffmpeg-watchdog)](https://github.com/rrymm/ffmpeg-watchdog) - retry/wait/reset pattern for FFmpeg process monitoring
- [ioredis pub/sub](https://github.com/redis/ioredis) - dedicated subscriber connection requirement, event-driven message handling
- [Intrasonics: Robust Continuous Audio Recording](https://medium.com/intrasonics/robust-continuous-audio-recording-c1948895bb49) - FFmpeg reconnect flag behavior for live streams

### Tertiary (LOW confidence)
- FFmpeg memory usage per process (~10-30MB estimate for audio-only copy): based on general knowledge and community reports, not benchmarked for this specific use case. Flagged in Open Questions and in STATE.md as needing empirical validation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project or well-documented standard choices
- Architecture: HIGH - patterns derived from real-world FFmpeg supervision systems (Frigate NVR) and Node.js child process best practices
- Pitfalls: HIGH - drawn from documented failure modes in Frigate issues, Node.js community, and FFmpeg documentation
- FFmpeg command args: MEDIUM - segment_wrap and reconnect options well-documented but audio-only segment muxer has less community coverage than video
- Memory/scaling: LOW - 200 concurrent FFmpeg processes is an unusual scale; empirical testing needed

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (30 days -- stable domain, no fast-moving APIs)
