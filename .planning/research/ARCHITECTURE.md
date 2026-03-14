# Architecture Research

**Domain:** Music broadcast monitoring platform (radio/TV airplay tracking)
**Researched:** 2026-03-14
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
                            EXTERNAL
                    ┌─────────────────────┐
                    │      ACRCloud       │
                    │  (Fingerprint DB +  │
                    │   Detection Engine) │
                    └──────────┬──────────┘
                               │ callbacks (JSON)
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      INGESTION LAYER                                 │
│  ┌───────────────┐  ┌────────────────┐  ┌────────────────────────┐  │
│  │ Stream Manager│  │ Callback       │  │ Snippet Extractor      │  │
│  │ (FFmpeg       │  │ Receiver       │  │ (cuts 5s clips from    │  │
│  │  workers)     │  │ (webhook       │  │  recorded stream at    │  │
│  │               │  │  endpoint)     │  │  detection timestamp)  │  │
│  └───────┬───────┘  └───────┬────────┘  └───────────┬────────────┘  │
│          │                  │                        │               │
│          │ raw audio        │ detection events       │ audio clips   │
│          ▼                  ▼                        ▼               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐       │
│  │ Ring Buffer   │  │ Job Queue    │  │ Object Storage       │       │
│  │ (temp audio   │  │ (Redis/      │  │ (S3-compatible)      │       │
│  │  per stream)  │  │  BullMQ)     │  │                      │       │
│  └──────────────┘  └──────┬───────┘  └──────────────────────┘       │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        CORE LAYER                                    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    API Server                                  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │  │
│  │  │ Auth     │ │Detection │ │Analytics │ │ Admin            │ │  │
│  │  │ Module   │ │ Module   │ │ Module   │ │ Module           │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    Data Layer                                  │  │
│  │  ┌───────────────┐  ┌─────────────┐  ┌─────────────────────┐ │  │
│  │  │ PostgreSQL    │  │ Redis       │  │ Object Storage      │ │  │
│  │  │ (detections,  │  │ (cache,     │  │ (audio snippets)    │ │  │
│  │  │  users, meta) │  │  sessions,  │  │                     │ │  │
│  │  │               │  │  queues)    │  │                     │ │  │
│  │  └───────────────┘  └─────────────┘  └─────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               │ REST API + WebSocket
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                                    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    iOS App (SwiftUI)                            │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │  │
│  │  │ Live     │ │Dashboard │ │ Station  │ │ Admin            │ │  │
│  │  │ Feed     │ │ & Stats  │ │ Views    │ │ Panel            │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Stream Manager** | Maintains 200+ concurrent audio stream connections, records raw audio into rolling ring buffers per stream | FFmpeg processes managed by a supervisor (one process per stream or batched) |
| **Callback Receiver** | Receives real-time detection results from ACRCloud via webhook POST | HTTP endpoint on your backend; ACRCloud POSTs JSON per detection |
| **Snippet Extractor** | When a detection arrives, looks up the ring buffer for that stream and cuts a 5-second audio clip at the detection timestamp | Worker triggered by job queue; uses FFmpeg to slice from ring buffer |
| **Job Queue** | Decouples detection ingestion from snippet extraction and DB writes; handles retries and backpressure | Redis + BullMQ (Node.js) or similar |
| **API Server** | Serves REST endpoints + WebSocket for the iOS app; handles auth, RBAC, data queries, snippet URLs | Express/Fastify/Hono (Node.js) or equivalent |
| **PostgreSQL** | Stores detections, users, stations, songs, analytics aggregates | Partitioned by time (or TimescaleDB) for detection events |
| **Redis** | Caching hot queries, session/token storage, job queue backing store, pub/sub for live feed | Single Redis instance initially, can cluster later |
| **Object Storage** | Stores 5-second audio snippets durably, served to iOS via presigned URLs | S3, DigitalOcean Spaces, Cloudflare R2, or MinIO |
| **iOS App** | Presents detections, dashboards, station data; plays audio snippets; role-based views | SwiftUI with URLSession, AVPlayer for audio |

## Recommended Project Structure

This is a multi-service system. Recommended monorepo with clear service boundaries.

```
myFuckingMusic/
├── services/
│   ├── stream-monitor/          # Stream recording + snippet extraction
│   │   ├── src/
│   │   │   ├── supervisor.ts    # Manages FFmpeg child processes
│   │   │   ├── ring-buffer.ts   # Rolling audio buffer per stream
│   │   │   ├── snippet.ts       # Extracts 5s clips on detection
│   │   │   └── health.ts        # Health check endpoint
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── callback-worker/         # Receives ACRCloud webhooks + processes
│   │   ├── src/
│   │   │   ├── webhook.ts       # POST /webhook/acr endpoint
│   │   │   ├── processor.ts     # Normalizes + enriches detection data
│   │   │   ├── queue.ts         # Enqueues snippet extraction jobs
│   │   │   └── dedup.ts         # Deduplicates overlapping detections
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── api/                     # REST + WebSocket API for iOS
│       ├── src/
│       │   ├── routes/
│       │   │   ├── auth.ts      # Invite-only auth
│       │   │   ├── detections.ts# Detection queries
│       │   │   ├── stations.ts  # Station management
│       │   │   ├── analytics.ts # Aggregated stats
│       │   │   ├── snippets.ts  # Presigned URL generation
│       │   │   ├── admin.ts     # Admin operations
│       │   │   └── export.ts    # CSV/PDF export
│       │   ├── ws/
│       │   │   └── live-feed.ts # WebSocket live detection feed
│       │   ├── middleware/
│       │   │   ├── auth.ts      # JWT validation + RBAC
│       │   │   └── rate-limit.ts
│       │   ├── db/
│       │   │   ├── schema.ts    # Database schema
│       │   │   └── migrations/
│       │   └── lib/
│       │       ├── storage.ts   # S3 client abstraction
│       │       └── acr.ts       # ACRCloud API client
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   └── shared/                  # Shared types, constants, utilities
│       ├── types/
│       │   ├── detection.ts
│       │   ├── station.ts
│       │   └── user.ts
│       └── constants/
│
├── ios/                         # iOS app (Xcode project)
│   └── myFuckingMusic/
│       ├── Models/
│       ├── Views/
│       ├── ViewModels/
│       ├── Services/
│       │   ├── APIClient.swift
│       │   ├── WebSocketManager.swift
│       │   └── AudioPlayer.swift
│       └── App/
│
├── infra/                       # Infrastructure as code
│   ├── docker-compose.yml
│   └── k8s/ or terraform/
│
└── .planning/                   # Project planning
```

### Structure Rationale

- **services/stream-monitor:** Isolated because it has fundamentally different resource requirements (CPU/memory for FFmpeg processes, disk I/O for ring buffers). Must run on machines with good network connectivity to stream sources. Scales independently from the API.
- **services/callback-worker:** Separated from the API because webhook ingestion must be highly available and fast. ACRCloud retries callbacks, but you want near-instant acknowledgment. Decoupled via job queue so snippet extraction does not block webhook response.
- **services/api:** Standard REST + WebSocket server. Stateless, horizontally scalable. All iOS client communication goes through here.
- **packages/shared:** Type safety across services. Detection types, station types, and user types must be consistent between callback-worker (writes) and api (reads).
- **ios/:** Separate Xcode project. Communicates only via the API service.

## Architectural Patterns

### Pattern 1: Event-Driven Ingestion Pipeline

**What:** ACRCloud pushes detection events via webhook. Your callback receiver acknowledges immediately (200 OK), then enqueues the event for async processing. Workers consume the queue to: (1) normalize and store the detection in PostgreSQL, (2) trigger snippet extraction from the ring buffer, (3) upload the snippet to object storage, (4) broadcast the detection via WebSocket to connected clients.

**When to use:** Always -- this is the core data flow of the entire system.

**Trade-offs:**
- PRO: Webhook endpoint responds in < 50ms (ACRCloud won't time out or retry unnecessarily)
- PRO: Snippet extraction failures don't lose detection data
- PRO: Natural backpressure handling during detection spikes
- CON: Adds Redis as infrastructure dependency
- CON: Slightly more complex than synchronous processing

**Example:**
```typescript
// callback-worker/webhook.ts
app.post('/webhook/acr', async (req, res) => {
  const detection = parseACRPayload(req.body);

  // Acknowledge immediately
  res.status(200).json({ received: true });

  // Enqueue for async processing
  await detectionQueue.add('process-detection', {
    streamId: detection.streamId,
    timestamp: detection.timestamp,
    metadata: detection.metadata,
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  });
});

// callback-worker/processor.ts
detectionQueue.process('process-detection', async (job) => {
  const { streamId, timestamp, metadata } = job.data;

  // 1. Deduplicate (same song on same station within threshold)
  if (await isDuplicate(streamId, metadata.acrid, timestamp)) return;

  // 2. Store detection in PostgreSQL
  const detection = await db.detections.insert({
    stationId: streamId,
    songTitle: metadata.title,
    artistName: metadata.artists[0].name,
    acrid: metadata.acrid,
    isrc: metadata.isrc,
    confidence: metadata.score,
    detectedAt: timestamp,
    playedDuration: metadata.played_duration,
  });

  // 3. Trigger snippet extraction
  await snippetQueue.add('extract-snippet', {
    detectionId: detection.id,
    streamId,
    timestamp,
  });

  // 4. Broadcast to live feed
  await redis.publish('live-detections', JSON.stringify(detection));
});
```

### Pattern 2: Ring Buffer for Audio Recording

**What:** Each monitored stream has a dedicated FFmpeg process that records audio into a rolling ring buffer on disk (e.g., last 2-3 minutes of audio per stream). When a detection callback arrives, the snippet extractor reads from this buffer at the precise timestamp and cuts a 5-second clip. The buffer continuously overwrites old data, keeping disk usage bounded.

**When to use:** When you need to capture audio at the moment of detection but don't want to store entire stream recordings permanently.

**Trade-offs:**
- PRO: Bounded disk usage (~2-3 min per stream x 200 streams is manageable)
- PRO: Timestamp-based extraction is precise
- CON: If detection callback is delayed beyond buffer window, snippet is lost
- CON: 200+ FFmpeg processes require careful resource management

**Example:**
```typescript
// stream-monitor/supervisor.ts
function startStreamRecording(stream: Stream): ChildProcess {
  // Record to a rolling segment-based buffer
  // -f segment creates rolling files, -segment_time 30 = 30s segments
  // -segment_wrap 6 = keep only last 6 segments (3 min total)
  const ffmpeg = spawn('ffmpeg', [
    '-i', stream.url,
    '-f', 'segment',
    '-segment_time', '30',
    '-segment_wrap', '6',
    '-segment_format', 'mp3',
    '-ar', '22050',           // Lower sample rate (sufficient for fingerprinting proof)
    '-ac', '1',               // Mono
    '-b:a', '64k',            // Low bitrate (these are proof snippets, not HiFi)
    '-strftime', '0',
    `${BUFFER_DIR}/${stream.id}/segment_%03d.mp3`,
  ]);

  return ffmpeg;
}

// stream-monitor/snippet.ts
async function extractSnippet(
  streamId: string,
  timestamp: Date,
  durationSec: number = 5
): Promise<Buffer> {
  // Find the segment file containing this timestamp
  const segmentFile = await findSegmentForTimestamp(streamId, timestamp);

  // Extract 5-second clip using FFmpeg
  const output = `${TEMP_DIR}/${uuidv4()}.mp3`;
  await execAsync(`ffmpeg -i ${segmentFile} -ss ${offsetInSegment} -t ${durationSec} -y ${output}`);

  const buffer = await fs.readFile(output);
  await fs.unlink(output);
  return buffer;
}
```

### Pattern 3: Presigned URLs for Audio Playback

**What:** Instead of streaming audio through your API server, generate short-lived presigned URLs pointing directly to snippets in object storage. The iOS app fetches the URL from your API, then streams audio directly from S3/R2. This keeps your API server stateless and offloads bandwidth.

**When to use:** Always for audio snippet playback. Never proxy audio through your API.

**Trade-offs:**
- PRO: API server handles zero audio bandwidth
- PRO: Object storage CDN handles caching and global distribution
- PRO: No credentials embedded in iOS app
- CON: Slight latency for URL generation (negligible, < 10ms)

**Example:**
```typescript
// api/routes/snippets.ts
router.get('/detections/:id/snippet', auth, async (req, res) => {
  const detection = await db.detections.findById(req.params.id);
  if (!detection?.snippetKey) return res.status(404).json({ error: 'No snippet' });

  const url = await s3.getSignedUrl('getObject', {
    Bucket: SNIPPET_BUCKET,
    Key: detection.snippetKey,
    Expires: 3600, // 1 hour
  });

  res.json({ url, expiresIn: 3600 });
});
```

```swift
// iOS: AudioPlayer.swift
func playSnippet(for detectionId: String) async throws {
    let response = try await apiClient.get("/detections/\(detectionId)/snippet")
    let snippetURL = URL(string: response.url)!
    let playerItem = AVPlayerItem(url: snippetURL)
    player.replaceCurrentItem(with: playerItem)
    player.play()
}
```

## Data Flow

### Primary Data Flow: Detection Pipeline

```
Radio/TV Stream (HTTP/HTTPS/RTMP)
    │
    ▼
┌────────────────────────────────────────────────────┐
│ Stream Manager (your server)                        │
│                                                     │
│  FFmpeg Process (per stream)                        │
│    │                                                │
│    ├──► Ring Buffer (disk: rolling 3-min segments)  │
│    │                                                │
│    └──► [ACRCloud ingests from your stream URL      │
│          OR you use Local Monitoring Tool to        │
│          send fingerprints to ACRCloud]             │
└────────────────────────────────────────────────────┘
                                    │
         ACRCloud processes         │
         fingerprints against       │
         music database             │
                                    ▼
┌────────────────────────────────────────────────────┐
│ ACRCloud Detection Result (webhook callback)        │
│                                                     │
│  {                                                  │
│    stream_id, timestamp_utc,                        │
│    music: [{                                        │
│      title, artists, album, acrid, isrc,            │
│      score, played_duration, play_offset_ms         │
│    }]                                               │
│  }                                                  │
└─────────────────────┬──────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────┐
│ Callback Receiver                                   │
│   1. Validate + acknowledge (200 OK)                │
│   2. Enqueue to Redis/BullMQ                        │
└─────────────────────┬──────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────┐
│ Detection Worker                                    │
│   1. Deduplicate (same song, same station, < 30s)   │
│   2. Normalize metadata (ISRC, artist, song)        │
│   3. INSERT into PostgreSQL                         │
│   4. Trigger snippet extraction job                 │
│   5. Publish to Redis pub/sub (live feed)           │
└──────────┬─────────────────────┬───────────────────┘
           │                     │
           ▼                     ▼
┌──────────────────┐  ┌──────────────────────────────┐
│ PostgreSQL        │  │ Snippet Worker                │
│  detections table │  │  1. Read ring buffer segment  │
│  (partitioned     │  │  2. FFmpeg extract 5s clip    │
│   by month)       │  │  3. Upload to S3              │
│                   │  │  4. Update detection row      │
│                   │  │     with snippet_key          │
└──────────────────┘  └──────────────────────────────┘
```

### Client Data Flow: iOS App Queries

```
iOS App
    │
    ├──► GET /detections?stationId=X&date=Y ──► API Server ──► PostgreSQL
    │         (paginated, filtered by role)
    │
    ├──► GET /analytics/dashboard ──► API Server ──► PostgreSQL (aggregates)
    │         (daily/weekly/monthly stats)        ──► Redis (cached results)
    │
    ├──► WebSocket /ws/live ──► API Server ──► Redis pub/sub
    │         (real-time detection feed)
    │
    ├──► GET /detections/:id/snippet ──► API Server ──► S3 presigned URL
    │         (audio playback)                          │
    │                                                   ▼
    │                                          iOS AVPlayer streams
    │                                          directly from S3
    │
    └──► GET /export?format=csv&range=... ──► API Server ──► PostgreSQL
              (report generation)                        ──► CSV/PDF gen
```

### Key Data Flows

1. **Detection ingestion:** ACRCloud webhook -> callback receiver -> job queue -> PostgreSQL + S3. This is the highest-volume flow (~200 detections per minute at peak, assuming detections every ~60s per stream). Must be reliable with at-least-once semantics.

2. **Snippet lifecycle:** Detection timestamp -> ring buffer lookup -> FFmpeg extraction -> S3 upload -> presigned URL generation on request. Time-critical: must happen before ring buffer overwrites the relevant segment (~3 min window).

3. **Live feed:** Detection stored -> Redis PUBLISH -> API server WebSocket -> iOS clients. Low latency path for real-time display. Does not need to be perfectly reliable (if a client misses a message, they can query the API).

4. **Analytics aggregation:** Periodic job (cron or continuous aggregate) that computes daily/weekly/monthly play counts per song, per station, per artist. Read-heavy path that benefits from materialized views or caching.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 200 streams, ~8M detections/month | Single server for stream-monitor (16+ GB RAM for FFmpeg processes). Single PostgreSQL. Single API server. Redis for queue + cache. This is the v1 target. |
| 500 streams, ~20M detections/month | Split stream-monitor across 2-3 servers (geographic proximity to stream sources helps). PostgreSQL with time-based partitioning (monthly). Add read replica for analytics queries. CDN in front of S3 for snippet delivery. |
| 2000+ streams, ~100M detections/month | Stream-monitor fleet with orchestration (Kubernetes). PostgreSQL with TimescaleDB or move analytics to ClickHouse. Dedicated analytics DB (OLAP) separated from transactional DB (OLTP). Multiple API server instances behind load balancer. Redis Cluster. |

### Scaling Priorities

1. **First bottleneck: Stream Manager resources.** Each FFmpeg process consumes ~30-80 MB RAM and some CPU. At 200 streams, this is 6-16 GB RAM just for FFmpeg. Solution: dedicated machine for stream recording with sufficient resources. Monitor per-process resource usage.

2. **Second bottleneck: PostgreSQL query performance on detections table.** Millions of rows with time-range queries, group-by aggregations, and role-based filtering. Solution: partition the detections table by month from day one. Add appropriate indexes (station_id, detected_at, acrid, artist_id). Use materialized views for dashboard aggregates.

3. **Third bottleneck: Snippet storage costs.** At 200 streams with detections every 60 seconds, that is ~200 snippets/min = ~12,000/hour = ~288,000/day. At ~50 KB per 5-second MP3, that is ~14 GB/day = ~420 GB/month. Solution: use cheap object storage (R2 is free egress, DigitalOcean Spaces is $5/250 GB). Implement retention policies to archive or delete old snippets.

## Anti-Patterns

### Anti-Pattern 1: Processing Detections Synchronously in Webhook Handler

**What people do:** Receive ACRCloud webhook, immediately query the ring buffer, extract snippet, upload to S3, write to DB, and only then return 200.
**Why it's wrong:** ACRCloud has callback timeouts and retry logic. If your handler takes > 5 seconds, ACRCloud retries, causing duplicate processing. Under load, the webhook handler becomes a bottleneck and detections are lost.
**Do this instead:** Acknowledge immediately (200 OK), enqueue the event, and process asynchronously. The job queue handles retries, backpressure, and failure recovery.

### Anti-Pattern 2: Storing Audio Snippets in the Database

**What people do:** Store 5-second audio clips as BYTEA/BLOB columns in PostgreSQL.
**Why it's wrong:** Bloats the database enormously (420 GB/month of binary data). Kills backup performance. Makes vacuuming extremely slow. PostgreSQL is not designed for large binary storage.
**Do this instead:** Store snippets in object storage (S3/R2/Spaces). Store only the object key (string) in the database row. Serve via presigned URLs.

### Anti-Pattern 3: One Giant "Detections" Query for All Analytics

**What people do:** Run complex aggregation queries (GROUP BY station, song, day, week, month) directly on the detections table for every dashboard load.
**Why it's wrong:** At millions of rows, these queries take seconds to minutes. Every dashboard view hammers the database. Kills performance for the ingestion pipeline which shares the same DB.
**Do this instead:** Pre-compute aggregates. Use materialized views refreshed on a schedule (e.g., every 15 minutes), or maintain separate aggregate tables updated incrementally when detections are inserted. Cache dashboard results in Redis with short TTL (1-5 min).

### Anti-Pattern 4: Recording Full Streams Permanently

**What people do:** Store the complete audio recording of every stream 24/7.
**Why it's wrong:** 200 streams x 24 hours x ~28 MB/hour (64 kbps) = ~134 GB/day = ~4 TB/month. Massive storage cost with minimal value beyond the 5-second snippet. Legal risk of storing full copyrighted broadcasts.
**Do this instead:** Use rolling ring buffers that only retain the last 2-3 minutes per stream. Extract and keep only the 5-second snippet. Delete the buffer segments automatically.

### Anti-Pattern 5: Polling ACRCloud API Instead of Using Callbacks

**What people do:** Set up a cron job that polls ACRCloud's results API every N seconds for each stream.
**Why it's wrong:** 200 streams x polling every 10 seconds = 1,200 API calls/minute. Wastes API quota, adds latency, and is fragile. ACRCloud's callback system is specifically designed to push results to you.
**Do this instead:** Configure callback URLs in your ACRCloud project. Your system receives detections in near-real-time (about 1 minute delay) without polling.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **ACRCloud** | Two modes: (1) ACRCloud ingests from your stream URLs directly ("BM-ACRC" type), or (2) you run the Local Monitoring Tool to fingerprint locally and send to ACRCloud. Detections delivered via webhook POST to your callback URL. | Use "Custom Streams" project type. Configure `result_callback_url` to point to your callback-worker. Set `result_callback_send_noresult: NO` to reduce noise. ACRCloud returns: acrid, title, artists, album, ISRC, UPC, score, played_duration, play_offset_ms, Spotify/Deezer IDs. Detection arrives ~60s after broadcast. |
| **S3-compatible storage** | Standard S3 API (PutObject for upload, GetSignedUrl for serving). | Cloudflare R2 recommended for zero egress fees. DigitalOcean Spaces as alternative. Organize keys as `snippets/{station_id}/{YYYY-MM-DD}/{detection_id}.mp3`. |
| **Apple Push Notification** | For digest notifications (daily/weekly summaries). Not for individual detections. | Use APNs via a library. Batch digest generation via cron job. |
| **CSV/PDF Export** | Server-side generation. CSV via streaming write. PDF via a library (e.g., PDFKit). | Generate on-demand or background job for large reports. Serve via presigned S3 URL. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Stream Manager <-> Callback Worker | Indirect via shared ring buffer on disk (or network volume) + ACRCloud as intermediary | Stream Manager writes audio; Callback Worker reads it for snippet extraction. They do not communicate directly. They share a filesystem. If separated to different machines, need shared network storage or the snippet extraction must co-locate with the stream recording. |
| Callback Worker <-> API Server | Redis pub/sub for live feed; shared PostgreSQL for detection data | Callback Worker writes; API Server reads. No direct HTTP calls between them. Redis pub/sub bridges the real-time channel. |
| API Server <-> iOS App | REST API (HTTPS) + WebSocket (WSS) | Standard client-server. JWT for auth. Role-based access control enforced server-side. |
| API Server <-> Object Storage | S3 API for presigned URL generation | API Server never proxies audio data. It only generates URLs. |

## Build Order (Dependencies Between Components)

The system has clear dependency chains that dictate build order.

```
Phase 1: Foundation
    PostgreSQL schema + migrations
    Redis setup
    Shared types/models
        │
        ▼
Phase 2: Ingestion Pipeline
    Stream Manager (FFmpeg ring buffers)
    ACRCloud project setup + callback configuration
    Callback Receiver (webhook endpoint)
    Detection Worker (queue consumer, DB writes)
    Snippet Extractor + S3 upload
        │
        ▼
Phase 3: API Layer
    Auth (invite-only, JWT)
    Detection query endpoints (depends on data from Phase 2)
    Snippet URL endpoints (depends on S3 from Phase 2)
    Station management (admin)
    WebSocket live feed (depends on Redis pub/sub from Phase 2)
        │
        ▼
Phase 4: iOS App
    API client + auth flow (depends on API from Phase 3)
    Detection list views
    Audio playback (depends on snippet URLs from Phase 3)
    Live feed (WebSocket)
    Dashboard / analytics views
        │
        ▼
Phase 5: Analytics + Polish
    Aggregation jobs (materialized views, cron)
    Dashboard stats endpoints
    Export (CSV/PDF)
    Digest notifications
    Admin tools
```

**Rationale:** You cannot build the API without data flowing in (Phase 2). You cannot build the iOS app without API endpoints to call (Phase 3). Analytics are read-path features that can be layered on once the core pipeline and basic API exist.

## Sources

- [ACRCloud Broadcast Monitoring](https://www.acrcloud.com/broadcast-monitoring/) - Service overview and capabilities
- [ACRCloud Custom Streams API](https://docs.acrcloud.com/reference/console-api/bm-projects/custom-streams-projects) - API endpoints, callback configuration, result format
- [ACRCloud Broadcast Monitoring for Music Tutorial](https://docs.acrcloud.com/tutorials/broadcast-monitoring-for-music) - Detection pipeline, result retrieval methods
- [ACRCloud Channel Results Format](https://docs.acrcloud.com/reference/console-api/bm-projects/broadcast-database-projects/channels-results) - Detailed result JSON structure with metadata fields
- [ACRCloud Local Monitoring Tool](https://docs.acrcloud.com/tools/local-monitoring-tool) - Self-hosted monitoring option
- [radiorabe/acr-webhook-receiver](https://github.com/radiorabe/acr-webhook-receiver) - Real-world ACRCloud webhook receiver implementation (Go, PostgreSQL JSONB)
- [TimescaleDB](https://www.timescale.com/) - Time-series PostgreSQL extension for high-volume detection storage
- [BullMQ](https://bullmq.io/) - Redis-backed job queue for Node.js
- [S3 Presigned URLs Guide](https://fourtheorem.com/the-illustrated-guide-to-s3-pre-signed-urls/) - Pattern for serving private audio to mobile clients
- [Robust Continuous Audio Recording](https://medium.com/intrasonics/robust-continuous-audio-recording-c1948895bb49) - Architecture for reliable 24/7 audio capture

---
*Architecture research for: Music broadcast monitoring platform (myFuckingMusic)*
*Researched: 2026-03-14*
