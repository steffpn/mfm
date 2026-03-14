# Project Research Summary

**Project:** myFuckingMusic
**Domain:** Music broadcast monitoring platform (24/7 radio/TV airplay tracking for Romanian market)
**Researched:** 2026-03-14
**Confidence:** HIGH

## Executive Summary

myFuckingMusic is a music broadcast monitoring platform that tracks airplay across 200+ Romanian radio and TV stations using ACRCloud for audio fingerprint detection. The system records audio streams 24/7, receives detection callbacks from ACRCloud, stores per-detection metadata and 5-second audio snippets, and presents aggregated analytics through an iOS app. Experts build these systems as event-driven pipelines: a recording layer feeds audio to the detection engine, a webhook receiver ingests results asynchronously via job queues, and a separate API layer serves clients. The recommended stack is Node.js/TypeScript with Fastify on the backend, PostgreSQL with TimescaleDB for time-series detection storage, Redis for queues and caching, Cloudflare R2 for snippet storage, and SwiftUI for the iOS client. This is a well-understood architecture with high-quality documentation across all components.

The killer differentiator is **playable 5-second audio snippets at the moment of detection** -- no major competitor offers consumer-friendly in-app playback of actual broadcast audio. Combined with 200+ Romanian station coverage (versus Media Forest's 13 stations), this creates an immediate and defensible market position. The platform serves four user personas (Artist, Label, Station, Admin) through role-based access, which creates network effects as labels invite their artists and stations compare against competitors.

The top risks are: (1) **legal exposure from storing copyrighted audio snippets** under Romanian/EU law -- this must be validated with a Romanian IP attorney before development begins; (2) **FFmpeg process rot** in the 24/7 stream recording layer, which is the most failure-prone component and requires dedicated health monitoring from day one; and (3) **ACRCloud detection deduplication**, where a single 3-minute song generates 18-36 separate callback events that must be aggregated into a single "airplay event" before any analytics are meaningful. All three risks have clear mitigation strategies documented in the research.

## Key Findings

### Recommended Stack

The backend is built on **Node.js 22 LTS** with **TypeScript 5.7+** and **Fastify 5.8.x** (2-3x faster than Express, native TypeScript, built-in JSON schema validation). Data storage uses **PostgreSQL 17** for relational data with **TimescaleDB 2.x** as an extension for time-series detection storage -- at the projected 2.2M detections/month, TimescaleDB is not optional but necessary (20x insert rate advantage, 450-14,000x faster time-range queries, 90% storage compression). **Redis 7.x** serves triple duty as cache, BullMQ job queue backend, and pub/sub for the live feed. Audio snippets go to **Cloudflare R2** for zero egress fees (saving 90-98% on bandwidth vs S3). The iOS app uses **Swift 6 / SwiftUI** targeting iOS 17+ with Swift Charts for dashboard visualizations and AVFoundation for snippet playback. The only external Swift dependency is **KeychainAccess** for secure token storage.

**Core technologies:**
- **Node.js 22 LTS + TypeScript + Fastify 5.8.x**: Backend runtime and API framework -- event-driven architecture handles 200+ concurrent stream connections, native TypeScript support, built-in schema validation
- **PostgreSQL 17 + TimescaleDB 2.x**: Relational + time-series storage -- handles millions of detections/month with auto-partitioning, continuous aggregates, and 90% compression
- **Redis 7.x + BullMQ 5.x**: Caching, job queues, and real-time pub/sub -- single dependency serving three critical infrastructure functions
- **Cloudflare R2**: Zero-egress audio snippet storage -- at ~225GB/month of snippets, egress costs would dominate on S3
- **Prisma 7**: Database ORM -- pure TypeScript client (Rust engine removed in v7), 3x faster queries, schema-first migrations
- **FFmpeg 7.x (direct spawn)**: Audio stream capture and 5-second snippet extraction -- fluent-ffmpeg was archived May 2025, use direct child_process.spawn
- **Swift 6 / SwiftUI (iOS 17+)**: iOS client with @Observable pattern, Swift Charts, AVFoundation for playback

### Expected Features

**Must have (table stakes):**
- 24/7 automated detection across 200+ streams -- the entire value proposition
- Per-detection data: station, timestamp, song, artist, duration, ISRC, confidence
- Aggregated stats dashboard (daily/weekly/monthly play counts, top stations)
- Station-level breakdown with trend data
- 5-second audio snippet capture, storage, and in-app playback -- the killer differentiator
- Invite-only auth with four roles (Admin, Artist, Label, Station)
- Admin station management (CRUD for streams) and user management (invitations, role assignment)
- Search and filtering (song, artist, date range, station)
- CSV data export
- Historical data access with date range queries

**Should have (differentiators, post-launch):**
- Live detection feed (WebSocket/SSE real-time stream of detections)
- Digest notifications (daily/weekly summaries via push, replacing per-detection spam)
- PDF report generation (branded, shareable airplay reports)
- Competitor station intelligence (stations see what other stations play)
- ISRC-based identification for CMO interoperability

**Defer (v2+):**
- Android app, web dashboard, public API, monetization/billing
- International expansion, CMO integration (UCMR-ADA, CREDIDAM)
- AI/ML trend predictions (no training data exists yet)
- Self-registration (invite-only is correct for niche B2B)
- Real-time charts/rankings (editorial product, not monitoring feature)

### Architecture Approach

The system is a three-layer architecture: an **Ingestion Layer** (stream recording via FFmpeg ring buffers, ACRCloud webhook receiver, snippet extraction workers), a **Core Layer** (Fastify API server with auth/detection/analytics/admin modules, backed by PostgreSQL/TimescaleDB + Redis + R2), and a **Client Layer** (SwiftUI iOS app). Communication between ingestion and API layers is indirect -- they share PostgreSQL for detection data and Redis pub/sub for the live feed. The key architectural pattern is **event-driven async processing**: the webhook receiver acknowledges ACRCloud callbacks immediately (200 OK) and enqueues processing via BullMQ. This decouples detection ingestion from snippet extraction and prevents webhook timeouts. Audio snippets are served via presigned URLs from R2 -- the API server never proxies audio data.

**Major components:**
1. **Stream Manager** -- Supervises 200+ FFmpeg child processes recording audio into rolling 3-minute ring buffers per stream (~5GB total RAM)
2. **Callback Worker** -- Receives ACRCloud webhooks, deduplicates detections, normalizes metadata, stores to PostgreSQL, triggers snippet extraction jobs
3. **Snippet Extractor** -- Reads ring buffer at detection timestamp, cuts 5-second clip via FFmpeg, uploads to R2, updates detection record
4. **API Server** -- Fastify REST + WebSocket serving the iOS app; handles auth (JWT), RBAC, detection queries, analytics, snippet URL generation, admin operations
5. **iOS App** -- SwiftUI client with dashboard, detection views, snippet playback (AVPlayer + presigned URLs), live feed, role-based navigation

### Critical Pitfalls

1. **Copyright/legal exposure from audio snippets** -- EU/Romanian law has no "fair use" doctrine; 5-second snippets may not fall under any copyright exception. Consult a Romanian IP attorney before building the snippet feature. Design snippet storage to be easily disabled. Implement strict access controls and retention limits (30-90 days). This is a Phase 0 blocker.

2. **FFmpeg process rot (silent stream death)** -- 200+ FFmpeg processes silently die, hang, or leak memory. MPEG-TS timestamp overflow at 26.5 hours causes catastrophic failures. Implement per-stream watchdog supervisors with 30-second health checks, silence detection, and proactive process restarts every 12-24 hours. Monitor last-seen-alive timestamp per stream.

3. **ACRCloud detection deduplication** -- A single 3-minute song generates 18-36 callback events. Without aggregation into "airplay events," play counts are 18-36x inflated. Build a gap-tolerance aggregation pipeline (same ACRID on same stream within 30-60 seconds = same play). Store raw detections AND aggregated events as separate tables.

4. **Database design for time-series scale** -- 2.2M detections/month without partitioning kills query performance within 2-3 months. Partition by month from the first migration. Pre-compute aggregation tables (daily/weekly/monthly rollups). Use TimescaleDB continuous aggregates.

5. **Snippet storage cost explosion** -- Millions of small objects create costs dominated by per-request fees and metadata overhead, not storage. Use efficient codec (AAC 128kbps, ~80KB per snippet), implement lifecycle policies from day one, calculate monthly cost projections before first detection.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 0: Legal Validation and Project Setup
**Rationale:** Copyright/legal exposure is the highest-impact risk. Building snippet infrastructure before legal validation could result in wasted work or liability. This phase also establishes the development environment.
**Delivers:** Legal opinion on snippet storage/playback, development environment (Docker Compose with PostgreSQL/TimescaleDB, Redis), project scaffolding (monorepo, shared types, CI/CD), database schema design with time-partitioning
**Addresses:** Station management schema, user/role schema, detection schema with TimescaleDB partitioning
**Avoids:** Copyright exposure (Pitfall 7), database design mistakes (Pitfall 4)

### Phase 1: Stream Recording Infrastructure
**Rationale:** Everything depends on reliably recording audio from 200+ streams. This is the most failure-prone component and must be hardened before any detection logic runs on top. The ring buffer architecture determines snippet feasibility.
**Delivers:** FFmpeg process supervisor with per-stream watchdogs, rolling ring buffer implementation, stream health monitoring dashboard, station management (admin CRUD for streams)
**Uses:** Node.js, FFmpeg (direct spawn), BullMQ for process lifecycle, PostgreSQL for station metadata
**Implements:** Stream Manager component, Ring Buffer pattern
**Avoids:** Stream recorder rot (Pitfall 1)

### Phase 2: Detection Pipeline
**Rationale:** With streams recording reliably, connect ACRCloud to receive and process detection results. This phase produces the raw data that all user-facing features consume. Deduplication logic must be correct before any analytics are built.
**Delivers:** ACRCloud Custom Streams project configuration, webhook receiver endpoint, detection processing worker (deduplicate, normalize, store), snippet extraction worker (cut from ring buffer, upload to R2), Redis pub/sub for live detection events
**Uses:** Fastify (webhook endpoint), BullMQ (job queues), Prisma (database writes), Cloudflare R2 (snippet storage), Zod (payload validation)
**Implements:** Callback Worker, Snippet Extractor, Event-Driven Ingestion Pipeline pattern
**Avoids:** Deduplication nightmare (Pitfall 2), ACRCloud single point of failure (Pitfall 5), snippet storage cost explosion (Pitfall 3)

### Phase 3: API Layer
**Rationale:** With detection data flowing and snippets stored, build the API that the iOS app will consume. Auth must come first since all endpoints are role-filtered. Detection query endpoints depend on data from Phase 2. Snippet URL endpoints depend on R2 uploads from Phase 2.
**Delivers:** Invite-only auth (JWT access + refresh tokens), RBAC middleware (Admin/Artist/Label/Station), detection query endpoints (paginated, filtered), snippet presigned URL generation, station analytics endpoints, admin endpoints (user management, invitations), CSV export, WebSocket live feed endpoint
**Uses:** Fastify, @fastify/jwt, @fastify/websocket, Prisma, Redis (caching + pub/sub), Zod
**Implements:** API Server component, Presigned URL pattern, all REST endpoints

### Phase 4: iOS App
**Rationale:** The API is ready to consume. Build the iOS client against real endpoints with real data flowing. Start with auth flow and core detection views, then add playback and dashboard.
**Delivers:** Auth flow (invite redemption, login, token management), detection list and detail views, audio snippet playback (AVPlayer with presigned URLs), aggregated dashboard with Swift Charts (daily/weekly/monthly stats), station breakdown views, search and filtering, CSV export trigger, role-based navigation (Artist/Label/Station/Admin views), admin panel (station and user management)
**Uses:** SwiftUI, Swift Charts, AVFoundation, KeychainAccess, URLSession (async/await)
**Implements:** iOS App component, all role-based views

### Phase 5: Analytics, Polish, and Post-Launch Features
**Rationale:** Core product is functional. Layer on pre-computed analytics for dashboard performance, then add P2 features informed by real usage data and detection volumes measured in production.
**Delivers:** TimescaleDB continuous aggregates and materialized views, cached dashboard endpoints, digest notifications (daily/weekly push via APNs), PDF report generation, live detection feed polish (server-side filtering, rate limiting), competitor station intelligence view, advanced filtering
**Implements:** Analytics aggregation pipeline, notification system

### Phase Ordering Rationale

- **Phase 0 before all else** because the legal question around audio snippets could fundamentally change the architecture. If snippets are not legally viable, the snippet extraction pipeline, R2 storage, and playback features all change. Better to know before building.
- **Phase 1 before Phase 2** because the detection pipeline depends on streams being recorded reliably. ACRCloud needs stream URLs to monitor, and snippet extraction needs the ring buffer to exist.
- **Phase 2 before Phase 3** because the API cannot serve detection data that does not exist. The API is a read layer over data produced by the ingestion pipeline.
- **Phase 3 before Phase 4** because the iOS app is a thin client consuming API endpoints. Building the app against stub data creates integration bugs.
- **Phase 5 last** because analytics and P2 features are enhancements that require real production data to design correctly. Detection volumes, query patterns, and user behavior inform aggregation strategy and notification design.
- **Deduplication in Phase 2, not Phase 5** because every downstream feature (dashboard, exports, notifications) depends on accurate play counts. Getting deduplication wrong early means every aggregate is wrong.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 0:** Legal research on Romanian/EU copyright exceptions for short audio clips -- requires consultation with a Romanian IP attorney, not just web research
- **Phase 1:** FFmpeg ring buffer implementation specifics -- the segment-based rolling buffer pattern needs prototyping to validate segment timing, disk I/O patterns, and the timestamp-to-segment lookup for snippet extraction
- **Phase 2:** ACRCloud Custom Streams API integration -- callback payload format, error handling, and deduplication edge cases need hands-on testing with real streams

Phases with standard patterns (skip deep research):
- **Phase 3:** REST API with JWT auth, RBAC, presigned URLs -- well-documented Fastify patterns, Prisma query patterns, standard S3 presigned URL generation
- **Phase 4:** SwiftUI iOS app with URLSession, AVPlayer, Swift Charts -- established Apple frameworks with extensive documentation
- **Phase 5:** TimescaleDB continuous aggregates, push notifications, PDF generation -- well-documented PostgreSQL and APNs patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified against official docs and current releases. Fastify 5.8.x, Prisma 7.x, TimescaleDB 2.x, Node.js 22 LTS all confirmed current. Version compatibility validated. |
| Features | HIGH | Competitive landscape thoroughly researched across 10+ competitors. Feature prioritization informed by real competitor gaps (audio proof, Romanian coverage). MVP scope is well-defined. |
| Architecture | HIGH | Event-driven ingestion pipeline is the established pattern for broadcast monitoring. Validated against real-world implementations (radiorabe/acr-webhook-receiver). Component boundaries and data flows are clear. |
| Pitfalls | HIGH | Pitfalls sourced from official FFmpeg bug trackers, ACRCloud documentation edge cases, real-world implementation issues, and EU/Romanian copyright law. Recovery strategies provided for each. |

**Overall confidence:** HIGH

### Gaps to Address

- **Romanian copyright law for audio snippets:** No definitive legal answer was found in web research. A Romanian IP attorney must provide a written opinion before the snippet feature is architected. This is the single biggest unknown in the project.
- **ACRCloud callback latency and reliability under load:** Research documents the callback model but real-world behavior with 200+ Custom Streams needs empirical testing. What happens when ACRCloud's detection engine is under load? How often are callbacks delayed beyond the ring buffer window (3 minutes)?
- **FFmpeg memory behavior at 200 concurrent processes on target hardware:** Research documents the 26.5-hour MPEG-TS overflow and memory leak patterns, but actual RAM consumption at 200 streams needs benchmarking on the target server (estimated 5-6GB for FFmpeg alone, but varies by stream codec and bitrate).
- **TimescaleDB continuous aggregates with Prisma 7:** Prisma does not natively manage TimescaleDB hypertables or continuous aggregates. Raw SQL migrations will be needed for TimescaleDB-specific features. The boundary between Prisma-managed schema and raw SQL needs to be defined during Phase 0.
- **iOS AVPlayer startup latency for 5-second clips:** Research flags that AVPlayer has 1-2 second startup latency for short clips. May need to use AVAudioPlayer or pre-buffering strategy. Needs testing during Phase 4 with real R2-hosted snippets.

## Sources

### Primary (HIGH confidence)
- [ACRCloud Broadcast Monitoring Docs](https://docs.acrcloud.com/tutorials/broadcast-monitoring-for-music) -- Detection pipeline, callback configuration, Custom Streams vs Broadcast Database modes
- [ACRCloud Streams Results API](https://docs.acrcloud.com/reference/console-api/bm-projects/custom-streams-projects/streams-results) -- API response format, query parameters, result JSON structure
- [ACRCloud Local Monitoring Tool](https://github.com/acrcloud/acrcloud_local_monitor) -- Self-hosted monitoring option, limitations
- [Prisma 7 Release](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0) -- Pure TypeScript client, Rust engine removed, performance improvements
- [Fastify v5 Releases](https://github.com/fastify/fastify/releases) -- Current version 5.8.1, Node 20+ requirement
- [PostgreSQL 17](https://www.postgresql.org/about/news/postgresql-17-released-2936/) -- JSON_TABLE, vacuum improvements, current at 17.9
- [Node.js 22 LTS](https://nodejs.org/en/about/previous-releases) -- LTS until April 2027
- [BullMQ Documentation](https://docs.bullmq.io) -- Job queue architecture, Redis Streams backend
- [SwiftUI Charts](https://developer.apple.com/documentation/charts) -- iOS 16+ framework, iOS 17/18 enhancements
- [fluent-ffmpeg Archival](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/issues/1324) -- Archived May 2025
- [FFmpeg MPEG-TS PCR Rollover Bug](https://trac.ffmpeg.org/ticket/11629) -- 26.5-hour timestamp overflow
- [Romanian Copyright Law](https://www.wipo.int/wipolex/en/legislation/details/5195) -- Law No. 8/1996

### Secondary (MEDIUM confidence)
- [TimescaleDB vs PostgreSQL benchmarks](https://maddevs.io/writeups/time-series-data-management-with-timescaledb/) -- Performance at scale (vendor-adjacent source)
- [Cloudflare R2 vs AWS S3](https://www.vantage.sh/blog/cloudflare-r2-aws-s3-comparison) -- Cost comparison, zero egress
- [radiorabe/acr-webhook-receiver](https://github.com/radiorabe/acr-webhook-receiver) -- Real-world ACRCloud webhook implementation
- [WebSocket iOS challenges](https://ably.com/topic/websockets-ios) -- Background suspension, reconnection storms
- [S3 Object Overhead](https://repost.aws/articles/ARrYlq-1h6SeexbiaYQQAGZg/s3-object-overhead-optimization) -- Small object metadata costs
- [BMAT Vericast](https://www.bmat.com/vericast-publishers/) -- Enterprise competitor with audio evidence
- [WARM](https://www.warmmusic.net/) -- 28,000+ station competitor
- [Radiostats/Songstats](https://songstats.com/platforms/radiostats) -- AI-powered 50,000+ station competitor
- [Media Forest Romania](https://mediaforest-group.com/) -- Only Romanian-specific competitor, ~13 stations

### Tertiary (LOW confidence)
- AAC vs MP3 quality comparison -- General consensus on 128kbps equivalence, no rigorous source
- iOS AVPlayer startup latency for short clips -- Anecdotal developer reports, needs empirical validation
- Romanian music industry iOS vs Android split -- Inferred from industry demographics, no hard data

---
*Research completed: 2026-03-14*
*Ready for roadmap: yes*
