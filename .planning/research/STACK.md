# Stack Research

**Domain:** Music broadcast monitoring platform with ACRCloud integration
**Researched:** 2026-03-14
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Node.js** | 22 LTS (22.x) | Runtime for backend services | Active LTS until April 2027. Event-driven architecture handles 200+ concurrent stream connections efficiently. Built-in WebSocket client. V8 12.x with faster JIT compilation and improved garbage collection. The standard runtime for I/O-heavy workloads like stream monitoring. |
| **TypeScript** | 5.7+ | Type safety across backend | Catches integration bugs at compile time. Critical when coordinating ACRCloud callbacks, database schemas, and API contracts. Fastify and Prisma have first-class TypeScript support. |
| **Fastify** | 5.8.x | HTTP API framework | 2-3x faster than Express. Native TypeScript support (written in TypeScript). Built-in JSON schema validation via Ajv. Plugin architecture fits the multi-service nature of the platform (API routes, auth, webhooks). OpenJS Foundation backed. |
| **PostgreSQL** | 17.x | Primary relational database | JSON_TABLE() for ACRCloud metadata. Improved vacuum performance for high-write detection tables. Native partitioning for time-series detection data. Rock-solid for relational data (users, stations, songs, roles). Currently at 17.9. |
| **TimescaleDB** | 2.x (extension) | Time-series detection storage | At 50M+ rows, vanilla PostgreSQL insert rate drops to ~5K rows/s while TimescaleDB maintains ~111K rows/s. 90% storage compression via columnar storage. Auto-partitioning by time eliminates manual partition management. Queries on time ranges are 450x to 14,000x faster. This system will generate millions of detections per month -- TimescaleDB is not optional, it is necessary. |
| **Redis** | 7.x | Caching, job queues, real-time pub/sub | In-memory store for live detection feed (pub/sub), BullMQ job queue backend, API response caching for dashboard aggregations. Single dependency serving three critical functions. |
| **FFmpeg** | 7.x (system binary) | Audio stream capture and snippet extraction | Industry-standard tool for continuous stream recording and 5-second snippet cutting. Called via Node.js child_process.spawn() -- no wrapper library needed (fluent-ffmpeg was archived May 2025). Direct spawning gives full control over the 200+ concurrent FFmpeg processes. |
| **Cloudflare R2** | Current | Audio snippet object storage | Zero egress fees vs S3's $0.09/GB. For a platform serving thousands of 5-second audio snippets daily to iOS clients, egress costs dominate. R2 saves 90-98% on bandwidth costs. S3-compatible API means zero lock-in. Free tier covers 10GB storage + 10M reads/month. |
| **Swift/SwiftUI** | Swift 6 / iOS 17+ | iOS client application | Project constraint: iOS only for v1. SwiftUI with @Observable (replaces old @ObservedObject patterns) for reactive UI. Swift Charts framework for dashboard visualizations (bar, line, pie charts built-in since iOS 16, with iOS 17/18 enhancements). Minimum iOS 17 target gives access to SectorMark charts and improved interactivity. |

### Supporting Libraries

#### Backend

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Prisma ORM** | 7.x | Database access layer | All database operations. Prisma 7 (Nov 2025): pure TypeScript client (Rust engine removed), 90% smaller bundles, 3x faster queries. Schema-first approach gives you migration management, type-safe queries, and Prisma Studio for debugging. |
| **BullMQ** | 5.x | Job queue for stream management | Managing 200+ stream recording jobs, retry logic for failed recordings, scheduled digest notification generation, CSV/PDF report generation. Redis Streams-backed with exactly-once semantics. Handles 1M+ jobs/day. |
| **@fastify/jwt** | Latest | JWT authentication | Invite-only auth flow: admin creates invite -> user redeems invite -> receives JWT pair (access + refresh tokens). Uses fast-jwt internally. Decorates request with jwtVerify for route protection. |
| **@fastify/websocket** | Latest | Real-time detection feed | Live feed of detections pushed to iOS clients. WebSocket over Fastify's existing HTTP server. Alternative: SSE (Server-Sent Events) is simpler for one-way feeds, but WebSocket chosen because the iOS client may need bidirectional communication (e.g., subscribing to specific station feeds). |
| **Zod** | 3.x | Runtime validation | Request/response validation via fastify-type-provider-zod. Validates ACRCloud callback payloads. Single source of truth for validation + TypeScript types. |
| **node-cron** | 3.x | Scheduled tasks | Digest notification scheduling (daily/weekly summaries), stale stream health checks, aggregation rollups. Lightweight cron scheduler for recurring tasks that don't need BullMQ's full queue semantics. |
| **@aws-sdk/client-s3** | 3.x | R2/S3 object storage client | Upload 5-second audio snippets to Cloudflare R2. AWS SDK v3 works with any S3-compatible storage. Modular imports keep bundle size small. |
| **pino** | 9.x | Structured logging | Fastify's built-in logger. JSON structured logs for production. 5x faster than Winston. Essential for debugging 200+ concurrent stream processes. |
| **bcrypt** | 5.x | Password hashing | Hashing invite codes and any future auth credentials. Proven, audited library for secure hashing. |

#### iOS Client

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Swift Charts** | Built-in (iOS 16+) | Data visualization | Dashboard stats: daily/weekly/monthly play counts, top stations, airplay trends. Native Apple framework -- no dependency needed. iOS 17 adds pie/donut charts, iOS 18 adds gesture support. |
| **AVFoundation / AVPlayer** | Built-in | Audio snippet playback | Playing 5-second audio snippets from R2 URLs. AVPlayer handles streaming from network URLs natively. AVAudioPlayer for cached local playback. No external library needed. |
| **KeychainAccess** | 4.x | Secure token storage | Storing JWT access/refresh tokens securely. Simple Swift wrapper over Keychain Services API. Data persists across app reinstalls. |
| **URLSession** | Built-in | Networking | API communication with async/await (Swift concurrency). No need for Alamofire -- URLSession with async/await is 15% faster under load, zero dependencies, and Apple-maintained. For this project's straightforward REST API, URLSession is sufficient. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Docker + Docker Compose** | Local development and deployment | Single docker-compose.yml runs PostgreSQL + TimescaleDB, Redis, and the Node.js services. Health checks for pg_isready and redis-cli ping. Named volumes for data persistence. |
| **ESLint + Prettier** | Code quality | @typescript-eslint for TypeScript linting. Prettier for formatting. Non-negotiable for team consistency. |
| **Vitest** | Testing | Fast, native TypeScript support, compatible with Jest API. Preferred over Jest for TypeScript projects in 2025+. |
| **Bull Board** | Queue monitoring dashboard | Visual dashboard for BullMQ queues. Monitor stream recording jobs, failed jobs, retry rates. Essential for operating 200+ concurrent stream jobs. |
| **Xcode 16+** | iOS development | Required for Swift 6 and iOS 17+ target. Instruments for profiling audio playback performance. |
| **Prisma Studio** | Database GUI | Built into Prisma. Browse and edit detection data during development. |

## Installation

### Backend

```bash
# Core framework and runtime
npm install fastify @fastify/websocket @fastify/jwt @fastify/cors @fastify/helmet @fastify/rate-limit

# Database
npm install prisma @prisma/client

# Job queue and caching
npm install bullmq ioredis

# Validation
npm install zod fastify-type-provider-zod

# Storage (Cloudflare R2 via S3 SDK)
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# Utilities
npm install pino node-cron bcrypt dotenv

# Dev dependencies
npm install -D typescript @types/node @types/bcrypt vitest @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint prettier prisma
```

### iOS (Swift Package Manager)

```swift
// Package.swift or Xcode SPM
dependencies: [
    .package(url: "https://github.com/kishikawakatsumi/KeychainAccess.git", from: "4.2.2")
]
// All other dependencies (Charts, AVFoundation, URLSession) are Apple frameworks - no external packages needed
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Fastify** | Express 5.x | Only if the team has deep Express expertise and doesn't want to learn Fastify. Express 5 is production-ready but slower, with bolted-on TypeScript support. |
| **Fastify** | NestJS | If the team wants Angular-style decorators and a heavily opinionated structure. Adds significant overhead and complexity for this project's scope. |
| **Prisma 7** | Drizzle ORM | If you need absolute minimum bundle size (7.4KB vs Prisma's larger footprint) or want SQL-like control over queries. Drizzle is faster for simple queries but lacks Prisma's migration tooling and ecosystem maturity. |
| **TimescaleDB** | Plain PostgreSQL partitioning | Never for this project. Manual partition management with millions of detections/month is operational overhead that TimescaleDB eliminates. Only consider plain PG if you have fewer than 1M total rows. |
| **Cloudflare R2** | AWS S3 | If you're already deep in the AWS ecosystem and egress costs are budgeted. S3 offers more advanced features (S3 Select, Glacier tiers, compliance certifications). |
| **Cloudflare R2** | Backblaze B2 | Cheaper storage ($0.006/GB vs R2's $0.015/GB) but has egress fees ($0.01/GB). Only wins if storage volume vastly exceeds read volume -- unlikely for this platform where snippets are frequently played. |
| **BullMQ** | Agenda (MongoDB-based) | Never. Agenda requires MongoDB as a dependency. BullMQ + Redis is faster, more reliable, and Redis is already needed for caching/pub-sub. |
| **URLSession** | Alamofire | If you need advanced features like request interception, retry policies, or multipart uploads. For this project's straightforward REST + JWT flow, URLSession with async/await is cleaner and faster. |
| **Server-Sent Events** | @fastify/websocket | SSE is simpler if the live feed is truly one-directional (server pushes detections, client only listens). Consider SSE if you find WebSocket is overkill during implementation. SSE has built-in auto-reconnect and Last-Event-ID resumption. |
| **child_process.spawn (FFmpeg)** | fluent-ffmpeg | Never. fluent-ffmpeg was archived May 2025 and doesn't work with recent FFmpeg versions. Direct spawn gives full control and avoids a dead dependency. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **fluent-ffmpeg** | Archived May 2025. Doesn't work with recent FFmpeg versions. Dead dependency with no maintenance. | Direct `child_process.spawn('ffmpeg', [...args])` calls. Wrap in a thin utility class for your project. |
| **Express 4.x** | No native async error handling, middleware-based architecture is slower, TypeScript support is community-maintained afterthought. Express 5 exists but Fastify is still faster. | Fastify 5.x |
| **MongoDB** | Detection data is inherently relational (songs belong to artists, detections belong to stations, users have roles). MongoDB's document model creates data duplication and consistency headaches for dashboard aggregations. | PostgreSQL + TimescaleDB |
| **Socket.IO** | Heavyweight abstraction over WebSocket with fallback to long-polling. Unnecessary for 2025 -- native WebSocket support is universal in iOS and modern browsers. Adds ~100KB to client bundle. | Native WebSocket via @fastify/websocket or SSE |
| **Firebase** | Vendor lock-in, limited query flexibility for complex time-series aggregations, not suitable for the custom stream monitoring architecture this project requires. | Self-hosted PostgreSQL + TimescaleDB + Redis |
| **Sequelize** | Legacy ORM with poor TypeScript support, verbose API, and performance issues with complex queries. | Prisma 7 |
| **Winston (logging)** | 5x slower than Pino. Fastify uses Pino natively -- using Winston means fighting the framework. | Pino 9.x (built into Fastify) |
| **Realm / SwiftData** | Local-first databases add complexity when the iOS app is primarily a thin client consuming API data. The app doesn't need offline-first capabilities for v1. | URLSession + simple in-memory caching |

## Stack Patterns by Variant

**If ACRCloud handles stream monitoring (Broadcast Database mode):**
- You do NOT need to run FFmpeg for fingerprinting -- ACRCloud monitors their own feeds
- You still need FFmpeg to record your own copy of streams for snippet extraction
- Simpler architecture: your backend only receives callbacks and records audio
- Use this if your Romanian stations are already in ACRCloud's broadcast database

**If you provide stream URLs to ACRCloud (Custom Streams mode):**
- You provide stream URLs via ACRCloud's Console API
- ACRCloud pulls and fingerprints the streams
- You still need your own FFmpeg recording pipeline for snippet extraction
- More control over which streams are monitored
- This is the likely mode since you're monitoring specific Romanian stations

**If you self-host monitoring (Local Monitoring Tool):**
- ACRCloud provides a Python-based local monitor tool
- Runs on your server, sends fingerprints to ACRCloud
- Requires MySQL for local result storage
- Most complex setup but lowest latency for results
- Only use if ACRCloud's cloud processing adds unacceptable latency

**Recommended approach: Custom Streams mode.** You manage stream URLs via ACRCloud's API, they handle fingerprinting in their cloud, results come back via callback URL to your Fastify server. You run parallel FFmpeg processes to record streams locally for snippet extraction.

## Architecture-Relevant Stack Decisions

### Audio Snippet Format
Use **AAC at 128kbps** for 5-second snippets.
- AAC at 128kbps sounds equivalent to MP3 at 192kbps
- 5 seconds at 128kbps AAC = ~80KB per snippet
- Native iOS playback support (no transcoding needed)
- At 200 stations with detections every ~3 minutes: ~96,000 snippets/day = ~7.5GB/day
- Monthly storage: ~225GB/month at $3.38/month on R2

### Detection Data Volume Estimates
- 200 stations, average 15 detections/hour per station
- ~72,000 detections/day, ~2.2M detections/month
- Each detection record: ~2KB (metadata + foreign keys)
- Monthly data growth: ~4.4GB/month in TimescaleDB (before compression)
- After TimescaleDB compression: ~440MB/month
- TimescaleDB continuous aggregates pre-compute dashboard rollups

### Stream Recording Architecture
- Each stream = 1 FFmpeg child process
- 200 streams = 200 FFmpeg processes
- Each process: ~20-30MB RAM = ~5GB total RAM for stream recording
- Server recommendation: 8+ CPU cores, 16GB+ RAM for the stream recorder service
- BullMQ manages process lifecycle: start, restart on failure, health monitoring

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Fastify 5.8.x | Node.js >= 20 | Requires Node 20+. Use Node 22 LTS. |
| Prisma 7.x | Node.js >= 18.18 | Requires TypeScript >= 5.1. Use TS 5.7+. |
| TimescaleDB 2.x | PostgreSQL 14-17 | Install as PostgreSQL extension. Use PG 17 for best performance. |
| BullMQ 5.x | Redis >= 6.2 | Use Redis 7.x for best performance. Requires ioredis as client. |
| @aws-sdk/client-s3 3.x | Node.js >= 16 | Works with any S3-compatible API (R2, MinIO, B2). |
| KeychainAccess 4.x | iOS 13+ / Swift 5+ | Compatible with iOS 17+ target and Swift 6. |
| Swift Charts | iOS 16+ | Minimum iOS 17 recommended for pie charts and interactivity. |
| fastify-type-provider-zod | Fastify 5.x, Zod 3.x | Bridges Zod schemas to Fastify's JSON Schema validation. |

## Sources

- [ACRCloud Broadcast Monitoring Docs](https://docs.acrcloud.com/tutorials/broadcast-monitoring-for-music) -- Architecture, API structure, Custom Streams vs Broadcast Database modes (HIGH confidence)
- [ACRCloud Streams Results API](https://docs.acrcloud.com/reference/console-api/bm-projects/custom-streams-projects/streams-results) -- API response format, query parameters, callback structure (HIGH confidence)
- [ACRCloud Local Monitoring Tool](https://github.com/acrcloud/acrcloud_local_monitor) -- Self-hosted monitoring option, Python-based (HIGH confidence)
- [Prisma 7 Release Announcement](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0) -- Version 7 features, Rust-free architecture, performance improvements (HIGH confidence)
- [Fastify v5 Releases](https://github.com/fastify/fastify/releases) -- Current version 5.8.1, security patches, Node 20+ requirement (HIGH confidence)
- [TimescaleDB vs PostgreSQL](https://maddevs.io/writeups/time-series-data-management-with-timescaledb/) -- Performance benchmarks at scale, 20x insert rate advantage (MEDIUM confidence - vendor-adjacent source)
- [Cloudflare R2 vs AWS S3](https://www.vantage.sh/blog/cloudflare-r2-aws-s3-comparison) -- Cost comparison, zero egress pricing (MEDIUM confidence)
- [fluent-ffmpeg Archival](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/issues/1324) -- Archived May 2025, migration guidance (HIGH confidence)
- [Node.js 22 LTS](https://nodejs.org/en/about/previous-releases) -- LTS schedule, EOL April 2027 (HIGH confidence)
- [PostgreSQL 17 Release](https://www.postgresql.org/about/news/postgresql-17-released-2936/) -- Features, current maintenance version 17.9 (HIGH confidence)
- [BullMQ Documentation](https://docs.bullmq.io) -- Job queue architecture, Redis Streams backend (HIGH confidence)
- [SwiftUI Charts](https://developer.apple.com/documentation/charts) -- iOS 16+ chart framework, iOS 17/18 enhancements (HIGH confidence)
- [Modern MVVM SwiftUI 2025](https://medium.com/@minalkewat/modern-mvvm-in-swiftui-2025-the-clean-architecture-youve-been-waiting-for-72a7d576648e) -- @Observable pattern, architecture evolution (MEDIUM confidence)
- [AAC vs MP3 Comparison](https://cloudinary.com/guides/front-end-development/aac-vs-mp3-the-future-of-audio-files) -- Quality at 128kbps, file size comparison (MEDIUM confidence)

---
*Stack research for: Music broadcast monitoring platform (myFuckingMusic)*
*Researched: 2026-03-14*
