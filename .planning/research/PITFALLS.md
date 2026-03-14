# Pitfalls Research

**Domain:** Music broadcast monitoring (24/7 radio/TV stream recognition with ACRCloud)
**Researched:** 2026-03-14
**Confidence:** HIGH (verified across official docs, open-source implementations, and multiple independent sources)

## Critical Pitfalls

### Pitfall 1: Stream Recorder Rot -- Silent Death of 24/7 FFmpeg Processes

**What goes wrong:**
FFmpeg processes recording 200+ audio streams silently die, hang, or leak memory over hours/days. MPEG-TS streams specifically exhibit timestamp overflow after 26.5 hours, causing catastrophic failures. Memory usage climbs dramatically roughly every 12 hours. You wake up to find 40 streams have been dead for 6 hours with zero detections and zero alerts -- and you have a gap in your monitoring data that can never be recovered.

**Why it happens:**
FFmpeg was designed for finite media processing, not infinite 24/7 recording. Network hiccups, stream source restarts, ISP routing changes, and radio station maintenance windows all cause disconnections. When FFmpeg reconnects with `-reconnect 1`, it creates time jumps in the output (a 7-second disconnect means a 7-second gap in your recording). Most teams treat stream recording as "set and forget" infrastructure, but it is the most failure-prone component in the entire system.

**How to avoid:**
- Implement a process supervisor per stream (not one FFmpeg process per stream -- use a wrapper that monitors, restarts, and reports). Each stream needs its own watchdog.
- Use `-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 30` flags (requires FFmpeg 4.4.1+).
- Implement silence detection: if a stream outputs silence for >60 seconds, flag it as potentially dead (radio stations sometimes go off-air but the stream stays "connected").
- Run health checks every 30 seconds per stream: is the process alive? Is it writing data? Is the data non-silent?
- Implement a "stream health dashboard" from day one that shows last-seen-alive timestamp per stream.
- Design for gaps: the system must gracefully handle and report monitoring gaps rather than pretending they did not happen.
- Restart FFmpeg processes on a schedule (every 12-24 hours) proactively to prevent memory leak accumulation.

**Warning signs:**
- Detection count per stream drops to zero for extended periods.
- Memory usage of stream recorder processes climbs steadily over days.
- Disk writes stop for a stream but the process still appears "running."
- ACRCloud returns no results for a stream that should be active.

**Phase to address:**
Phase 1 (Core Infrastructure). This is the foundation. If stream recording is unreliable, nothing else works. Must be solved before any detection logic is built on top.

---

### Pitfall 2: ACRCloud Detection Deduplication Nightmare

**What goes wrong:**
ACRCloud sends a detection callback every recognition interval (typically every 5-10 seconds of analyzed audio). A single 3-minute song generates 18-36 separate detection events. Without proper deduplication, your database fills with redundant records, your stats report "36 plays" for what was actually 1 play, and your aggregation queries become meaninglessly inflated. Artists see their song was "played 500 times today" when it was actually played 14 times.

**Why it happens:**
ACRCloud's broadcast monitoring is designed to report what it hears at each analysis interval -- it does not natively group consecutive detections of the same song into a single "play" event. The `play_offset_ms` and `played_duration` fields help, but merging consecutive detections of the same track on the same stream into a single "airplay event" is entirely your responsibility. Edge cases abound: a song interrupted by a jingle and resumed, the same song played twice in a row, cover versions vs originals, remixes with different ACRIDs.

**How to avoid:**
- Build a detection aggregation pipeline that groups consecutive detections of the same ACRID on the same stream into a single "airplay event" with start_time, end_time, and total_duration.
- Define a "gap tolerance" (e.g., if the same song is detected again within 30 seconds of the last detection, it is the same play; if the gap is >60 seconds, it is a new play).
- Store raw detections AND aggregated airplay events as separate tables. Never throw away raw data -- you will need it to debug aggregation bugs.
- Handle the "same song played back-to-back" case explicitly: if a station plays the same song twice consecutively, the gap tolerance must be tuned to distinguish this from a single long play.
- Use ACRCloud's `played_duration` field as a sanity check against your aggregation logic.

**Warning signs:**
- Play counts seem unrealistically high compared to manual spot-checks.
- A single song shows dozens of "plays" in a 5-minute window.
- Aggregated duration per play is suspiciously short (5-10 seconds instead of 3-4 minutes).
- Different detection intervals across streams produce inconsistent play counts for the same actual event.

**Phase to address:**
Phase 2 (Detection Pipeline). Must be implemented before any analytics or reporting is built. Aggregation logic is the translation layer between "what ACRCloud reports" and "what users care about."

---

### Pitfall 3: Audio Snippet Storage Cost Explosion

**What goes wrong:**
At 200+ streams with detections every few seconds, you generate millions of 5-second audio snippets per month. Storing each as an individual small file in object storage (S3/equivalent) creates a cost structure dominated by request fees and metadata overhead rather than actual storage. A naive implementation storing 5 million 5-second snippets per month as individual objects incurs significant per-request PUT/GET costs that dwarf the raw storage cost. After 6 months, storage costs become the largest infrastructure expense, and old snippets that no one ever listens to cost the same as fresh ones.

**Why it happens:**
Teams think about storage cost in terms of gigabytes, not in terms of number of objects and API calls. S3 charges per PUT request ($0.005 per 1,000), per GET request ($0.0004 per 1,000), and adds 32-40KB of metadata overhead per object in archival tiers. With millions of small objects, the overhead and request costs can be 10-40x the actual storage cost. Additionally, Intelligent Tiering charges a monitoring fee per object that grows faster than expected with millions of small files.

**How to avoid:**
- Batch snippets: instead of one file per detection, concatenate snippets into hourly or daily archive files per stream with an index/manifest that maps detection timestamps to byte offsets within the archive.
- Or use a fixed naming convention with lifecycle policies: `/{stream_id}/{YYYY}/{MM}/{DD}/{detection_id}.opus` with automatic transition to Infrequent Access after 30 days and Glacier after 90 days.
- Use Opus codec instead of MP3/WAV for 5-second snippets -- dramatically smaller file sizes at equivalent quality.
- Implement a retention policy from day one: snippets older than X months get deleted or archived to cheapest tier.
- Calculate expected monthly costs before building: (detections_per_month * avg_snippet_size * storage_cost) + (detections_per_month * request_cost) + (expected_retrievals * retrieval_cost).
- For the iOS app, generate signed/presigned URLs with expiration rather than proxying audio through your API server.

**Warning signs:**
- Monthly cloud bill growing faster than stream count.
- Storage costs exceed compute costs.
- Object count in storage bucket exceeds tens of millions.
- Users rarely play snippets older than 2 weeks but all snippets cost the same to store.

**Phase to address:**
Phase 1 (Core Infrastructure). Storage architecture decisions are extremely expensive to change later. The snippet storage pattern must be designed before detections start flowing.

---

### Pitfall 4: Database Design That Cannot Handle Time-Series Query Patterns

**What goes wrong:**
Detection data is time-series data, but teams model it as a simple flat table. Queries like "show me all detections for artist X in the last 30 days across all stations" or "what were the top 10 songs on station Y this week" become painfully slow once you have tens of millions of rows. Dashboard load times go from 200ms to 15 seconds. Aggregation queries for weekly/monthly reports lock the database.

**Why it happens:**
The schema seems simple at first: a `detections` table with timestamp, stream_id, song_id, and metadata. But at 200+ streams generating detections every few seconds, this table grows by millions of rows per month. Without partitioning, indexes become enormous and slow. Without pre-computed aggregations, every dashboard view requires scanning millions of rows. Without CQRS separation, heavy analytics queries compete with real-time detection writes.

**How to avoid:**
- Partition the detections table by time (monthly partitions are appropriate for this scale -- millions per month, not billions). Use PostgreSQL native range partitioning on the timestamp column.
- Pre-compute aggregation tables: daily_station_song_counts, weekly_artist_totals, monthly_summaries. Update these via background jobs, not on every query.
- Separate the write path (ingesting detections from ACRCloud callbacks) from the read path (serving the iOS app and reports). At minimum, use read replicas; ideally, materialize views for common query patterns.
- Index strategically: compound indexes on (stream_id, timestamp), (song_id, timestamp), (artist_id, timestamp). Do not rely on single-column indexes for multi-column query patterns.
- Implement data retention: detections older than 2 years can be archived to cold storage with only aggregated summaries kept in the hot database.
- Use pg_partman extension to automate partition creation and maintenance.

**Warning signs:**
- Dashboard queries taking >1 second with only a few months of data.
- Database CPU spikes during report generation.
- Table row counts approaching 50M+ without partitioning.
- `EXPLAIN ANALYZE` showing sequential scans on the detections table.

**Phase to address:**
Phase 1 (Database Schema Design). Retrofitting partitioning and aggregation tables onto a production database with millions of rows is extremely painful. Design for this from the schema's first migration.

---

### Pitfall 5: ACRCloud as Single Point of Failure Without Graceful Degradation

**What goes wrong:**
ACRCloud's API goes down, rate-limits your account, or their webhook callback delivery fails -- and your entire system stops producing detections. No fallback, no queuing, no retry. Worse: stream recording continues but detection results are lost because the system assumes ACRCloud is always available. When ACRCloud recovers, there is a gap in your detection history that cannot be retroactively filled.

**Why it happens:**
ACRCloud is a third-party SaaS with its own uptime guarantees (or lack thereof). Teams build tightly coupled integrations where the detection pipeline is synchronous: record audio -> send to ACRCloud -> receive result -> store. If any step fails, the entire chain breaks. The ACRCloud webhook callback model means their server must reach your server -- network issues on either side cause lost events.

**How to avoid:**
- Always record and retain raw audio independently of detection success. If ACRCloud is down for 2 hours, you have 2 hours of recorded audio that can be retroactively fingerprinted via ACRCloud's file scanning API once service recovers.
- Implement a webhook receiver with idempotent processing and a dead-letter queue for failed webhook deliveries. If a webhook fails to process, it should be retried.
- If using ACRCloud's local monitor tool, implement your own result persistence before forwarding to your main database -- SQLite locally as a buffer.
- Monitor ACRCloud's response times and error rates. Alert if detection results stop arriving for any stream.
- Build the detection pipeline as: record -> buffer -> fingerprint -> queue -> aggregate -> store. Each step should be independently recoverable.
- Validate webhook payloads with an API key to prevent spoofed detections.

**Warning signs:**
- Detection count drops to zero across all streams simultaneously (ACRCloud outage vs. your infrastructure issue).
- Webhook endpoint receives no callbacks for >5 minutes during normal broadcast hours.
- ACRCloud dashboard shows different detection counts than your local database.
- Error rates spike in your webhook receiver logs.

**Phase to address:**
Phase 2 (Detection Pipeline). The recording infrastructure (Phase 1) must already support independent audio retention. The detection pipeline must be designed with ACRCloud failure as a known, planned-for scenario.

---

### Pitfall 6: Real-Time Feed That Does Not Scale and Drains Mobile Batteries

**What goes wrong:**
The "live feed of detections" feature is implemented as persistent WebSocket connections from every iOS client to the API server. With 200+ streams producing detections every few seconds, the server broadcasts every detection to every connected client. Server resource usage scales linearly with connected clients. iOS devices drain battery maintaining persistent connections. Users on cellular connections experience high data usage. When the app goes to background on iOS, the WebSocket disconnects and reconnection storms occur when users return.

**Why it happens:**
WebSockets feel like the natural choice for "real-time" feeds, but "real-time" in broadcast monitoring means seconds-to-minutes of acceptable latency, not milliseconds. Teams over-engineer the real-time aspect. iOS aggressively suspends background apps and kills WebSocket connections -- you cannot maintain a persistent connection when the app is backgrounded.

**How to avoid:**
- Use polling with smart intervals instead of WebSockets for the MVP. Poll every 15-30 seconds. The "live feed" does not need sub-second latency -- a detection arriving 15 seconds after it happens is perfectly acceptable for this use case.
- If using WebSockets, implement server-side filtering: each client subscribes to specific streams or artists, not the global firehose. Fan-out only relevant detections.
- Implement pagination on the feed endpoint: return the last N detections since a given timestamp, not the entire backlog.
- For iOS background behavior: use silent push notifications (APNs) to notify the app of new detections rather than maintaining WebSocket connections. The app fetches new data when it comes to foreground.
- Rate-limit the feed: batch detections and send updates at most every 5-10 seconds, not per individual detection.
- Use ETags or last-modified headers for efficient polling.

**Warning signs:**
- Server memory usage scales linearly with connected iOS clients.
- Users report high battery drain.
- WebSocket reconnection storms after iOS app returns from background.
- API server CPU spikes correlate with number of connected clients, not detection volume.

**Phase to address:**
Phase 3 (API and iOS App). By this point, the detection pipeline and database are solid. The real-time feed design should be informed by actual detection volumes measured in Phase 2.

---

### Pitfall 7: Copyright and Legal Exposure from Audio Snippet Storage

**What goes wrong:**
The system stores 5-second audio snippets from copyrighted music broadcasts. The EU (and Romania specifically, under Law No. 8/1996 on Copyright) does not have a "fair use" doctrine like the US. There is no fixed time threshold (e.g., "5 seconds is always legal") that automatically makes audio sampling permissible. A rights holder challenges the service, and the entire snippet storage and playback feature becomes a legal liability.

**Why it happens:**
Teams assume the "5-second snippet" is universally safe because it is short. In the EU, copyright exceptions are narrowly defined: quotation for criticism/review, parody, pastiche, and news reporting. A monitoring service storing and playing back copyrighted audio may not clearly fall into any exception. The snippet is not being used for criticism or commentary -- it is being used as "proof of airplay." Romania's copyright enforcement has become stricter with EU Directive 2019/790 implementation.

**How to avoid:**
- Consult a Romanian IP attorney before building the snippet feature. This is not a technical problem -- it is a legal one.
- Design the snippet storage to be easily disabled or modified if legal counsel advises against it. Do not make snippets load-bearing for the core product.
- Implement access controls: snippets should only be accessible to authenticated, authorized users with a legitimate monitoring interest (artists checking their own songs, labels checking their catalog). Never expose snippets publicly.
- Implement strict retention limits: auto-delete snippets after 30-90 days. Shorter retention = smaller legal surface.
- Log all snippet access for audit purposes.
- Consider whether a spectrogram visualization or detection confidence metadata could serve the "proof of airplay" function without storing actual audio.
- The invite-only model helps here -- controlled access to a known user base is better than public access.

**Warning signs:**
- No legal opinion obtained before launch.
- Snippets are accessible without authentication.
- No retention policy -- snippets accumulate indefinitely.
- Snippet playback feature is publicly accessible or indexed by search engines.

**Phase to address:**
Phase 0 (Pre-development). Legal review should happen before any snippet storage architecture is built. The architectural decisions around snippets (format, retention, access control) should be informed by legal counsel.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store raw ACRCloud JSON blobs without normalization | Fast integration, no schema design needed | Queries become impossible at scale, no referential integrity, no efficient indexing | Never -- normalize on ingest, keep raw JSON as audit trail in separate column/table |
| Single-process stream recorder managing all 200+ streams | Simple deployment, one thing to monitor | One crash kills all monitoring, one slow stream blocks others, no horizontal scaling | Only during proof-of-concept with <10 streams |
| No pre-computed aggregations, calculate stats on-the-fly | Less code, simpler schema | Dashboard queries become seconds-long at millions of rows, database CPU spikes | Only for first 1-2 months while data volume is low |
| Polling ACRCloud API instead of webhooks | Simpler to implement, no public endpoint needed | Increased API usage, higher latency, potential rate limiting, wastes ACRCloud quota | Acceptable for development/testing, never for production |
| SQLite for detection storage | Zero setup, single-file database | Cannot handle concurrent writes from 200+ streams, no replication, no partitioning | Only for local development or single-stream testing |
| Storing snippets as WAV/MP3 instead of Opus | Simpler tooling, wider compatibility | 3-5x larger files, higher storage costs, higher bandwidth for iOS playback | Never -- Opus/AAC is universally supported on iOS and server-side |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| ACRCloud Webhooks | Assuming webhooks are guaranteed delivery -- they are not. Network issues, server restarts, or ACRCloud outages cause missed callbacks. | Implement idempotent webhook processing. Use ACRCloud's polling API as a backup to catch missed webhooks. Reconcile webhook data with API data periodically. |
| ACRCloud Local Monitor | Running it as-is from GitHub without understanding it is Linux-only with minimal error handling and no built-in reconnection logic. | Wrap the local monitor in a supervisor with custom health checks, reconnection logic, and alerting. Or build your own monitor using ACRCloud's SDK with proper error handling. |
| ACRCloud Confidence Scores | Treating all detections equally regardless of confidence score. Low-confidence matches (<70) are often false positives, especially with background music behind speech. | Filter by confidence score. Establish a threshold (85+ for high confidence, 70-84 for review). Log but do not surface low-confidence matches to users. |
| ACRCloud ACRID vs ISRC | Assuming ACRID (ACRCloud's internal ID) maps 1:1 to ISRC codes. It does not -- one ISRC can have multiple ACRIDs (different masters/releases), and some detections have no ISRC. | Use ACRID as the primary detection identifier. Map ACRID to ISRC via ACRCloud's metadata, but handle the one-to-many relationship. Build a local song catalog that normalizes these relationships. |
| Radio Stream URLs | Hardcoding stream URLs and assuming they are permanent. Romanian radio stations change stream URLs, switch between Icecast/Shoutcast, change codecs, or go offline without notice. | Build a stream health monitoring system. Store stream URL history. Implement admin alerts when a stream fails to connect for >15 minutes. Support multiple URL fallbacks per station. |
| iOS AVPlayer for Short Clips | Using AVPlayer for 5-second snippets -- it has significant startup latency (1-2 seconds) for each clip, making the UX feel sluggish. | Pre-buffer snippets. Use AVAudioEngine or AVAudioPlayer for short clips (lower startup latency). Pre-download the next likely snippet while the user browses. Consider AVQueuePlayer for sequential playback. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unpartitioned detections table | Slow dashboard queries, high DB CPU, sequential scans | Partition by month from day one using PostgreSQL range partitioning | At 10-20M rows (approximately 2-3 months of operation) |
| No connection pooling for DB | Connection exhaustion errors, "too many connections" | Use PgBouncer or built-in framework connection pooling, limit to pool size appropriate for DB plan | At 50+ concurrent API requests (modest iOS user base) |
| Synchronous snippet storage in detection pipeline | Detection processing slows down, backpressure on ACRCloud webhooks, webhook timeouts | Decouple snippet creation from detection processing. Queue snippet jobs asynchronously. | Immediately at 200+ streams -- synchronous I/O blocks detection throughput |
| N+1 queries in artist/label dashboards | Dashboard API calls taking 5-10 seconds, DB connection pool exhaustion | Eager-load related data, use materialized views for dashboard data, denormalize common query patterns | At 1000+ detections per dashboard view (first week of operation) |
| Full table scan for "latest detection per stream" | Live feed endpoint becomes slow, scales with total detection count instead of stream count | Maintain a separate `stream_latest_detection` table updated on each new detection, or use DISTINCT ON with proper indexing | At 5M+ total detections (approximately 1 month) |
| Unbounded API responses | iOS app crashes or hangs loading months of detection history, high bandwidth | Always paginate. Default page sizes of 50-100. Cursor-based pagination, not offset-based. | Immediately -- first user scrolling through history |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Unsigned snippet URLs | Anyone with a URL can access copyrighted audio snippets indefinitely | Use presigned URLs with short expiration (1-15 minutes). Require authentication for all snippet access. |
| Webhook endpoint without authentication | Attackers can inject fake detection data, corrupting monitoring records | Validate ACRCloud webhooks with API key parameter. Rate-limit the webhook endpoint. Validate payload structure before processing. |
| Invite codes without expiration or usage limits | Leaked invite codes allow unlimited unauthorized access | Expire invite codes after 48-72 hours. Single-use or limited-use codes. Log which code was used by which user. |
| Stream URLs in API responses | Exposes radio station stream URLs to app users who could use them for unauthorized purposes | Never return raw stream URLs to the iOS client. The client should only receive detection data and snippet URLs, never the underlying stream source. |
| Admin endpoints without role checks | Non-admin users can add/remove streams, manage users | Implement role-based access control from day one. Separate admin routes with middleware. Test authorization on every endpoint, not just authentication. |
| Detection data without tenant isolation | Artists see other artists' data, labels see competitors' catalogs | Implement row-level filtering based on user role and associated entity (artist_id, label_id). Never rely on frontend filtering alone. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing raw detection data instead of aggregated plays | Users see 36 entries for a single song play, data feels unreliable and noisy | Show aggregated "airplay events" with start time, duration, and station. Allow drill-down to raw detections only if needed. |
| No timezone handling -- showing UTC timestamps | Romanian users see timestamps 2-3 hours off from actual broadcast time, causing confusion and mistrust | Store in UTC, display in user's timezone (Romania is EET/EEST, UTC+2/+3). Handle DST transitions. |
| Live feed showing all 200+ stations to every user | Information overload -- artists do not care about stations that never play their music | Default to showing only relevant detections (user's songs/label). Allow opt-in to broader monitoring. |
| Play counts without context | "Your song was played 47 times this week" means nothing without comparison | Show trends (up/down from last week), station distribution, time-of-day patterns. Context makes data actionable. |
| CSV/PDF export of raw data | Users get massive files with technical field names they do not understand | Export aggregated, human-readable reports. Include column headers that make sense to non-technical music industry users. Name columns "Station," "Song Title," "Play Count" -- not "stream_id," "acrid," "detection_count." |
| Snippet playback with no loading state | User taps play, nothing happens for 1-2 seconds while audio loads, they tap again creating duplicate playback | Show loading spinner immediately on tap. Pre-buffer snippets where possible. Debounce play button taps. |

## "Looks Done But Isn't" Checklist

- [ ] **Stream Recording:** Often missing silence detection -- verify that a "connected" stream producing silence for >2 minutes triggers an alert, not just connection failure detection.
- [ ] **Detection Pipeline:** Often missing gap handling -- verify that when a stream was down for 30 minutes, the dashboard shows "no data" for that period, not zero plays.
- [ ] **Snippet Storage:** Often missing retention policy -- verify that snippets older than the retention period are actually being deleted, not just flagged.
- [ ] **Aggregation Logic:** Often missing the "same song back-to-back" case -- verify that a station playing the same song twice in a row produces two separate airplay events, not one long one.
- [ ] **Real-time Feed:** Often missing reconnection logic -- verify that when the iOS app returns from background, it fetches missed detections, not just resumes from current.
- [ ] **Timezone Display:** Often missing DST transitions -- verify that timestamps display correctly during Romania's spring/fall clock changes (last Sunday of March/October).
- [ ] **Role-Based Access:** Often missing negative cases -- verify that an artist CANNOT see another artist's data, not just that they CAN see their own.
- [ ] **Export Reports:** Often missing date range limits -- verify that requesting a 2-year export does not crash the server or produce a 500MB file.
- [ ] **Admin Stream Management:** Often missing URL validation -- verify that adding an invalid or unreachable stream URL produces a clear error, not a silent failure that looks "added."
- [ ] **Invite System:** Often missing revocation -- verify that deactivating a user also invalidates their active sessions and any unused invite codes they generated.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stream recorder failure (gap in monitoring) | MEDIUM | Identify gap duration from health logs. If raw audio was retained, reprocess through ACRCloud file scanning API. If not, mark the gap in detection data so reports reflect it honestly. |
| Deduplication bug (inflated play counts) | HIGH | Reprocess raw detections through corrected aggregation logic. Regenerate all aggregation tables. Notify affected users that historical counts were corrected. Cannot recover data that was never stored. |
| Storage cost explosion | MEDIUM | Implement lifecycle policies retroactively. Batch-convert existing snippets to more efficient format. Delete snippets older than retention threshold. Takes days/weeks for full S3 lifecycle transitions. |
| Unpartitioned database at scale | HIGH | Requires maintenance window. Create partitioned table, migrate data in batches (potentially millions of rows), swap table names. Risk of data loss if done incorrectly. Plan for 4-8 hours of degraded service. |
| ACRCloud outage data loss | LOW-HIGH | Low if raw audio was retained (reprocess). High if raw audio was not retained (data is permanently lost for the outage period). |
| Legal challenge to snippet storage | HIGH | Disable snippet playback feature. Delete stored snippets per legal guidance. Redesign the "proof of airplay" feature without actual audio. Potential service disruption for users. |
| Real-time feed overloading server | LOW | Switch to polling. Add server-side filtering. Rate-limit per client. Can be done with a deployment, no data migration needed. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Stream recorder rot | Phase 1 - Core Infrastructure | Each stream has a health status visible in admin dashboard; no stream goes >5 minutes without a health check |
| Detection deduplication | Phase 2 - Detection Pipeline | Aggregated play counts match manual spot-checks against actual radio broadcast logs for a sample of stations |
| Snippet storage costs | Phase 1 - Core Infrastructure | Monthly cost projection calculated and validated before first detection is stored; lifecycle policies active from day one |
| Database schema for scale | Phase 1 - Database Schema | Table partitioning active from first migration; EXPLAIN ANALYZE on dashboard queries shows partition pruning |
| ACRCloud single point of failure | Phase 2 - Detection Pipeline | Raw audio retained independently; simulated ACRCloud outage test shows data can be recovered via file scanning |
| Real-time feed scalability | Phase 3 - API and iOS App | Load test with 500 simulated concurrent clients shows stable server resources; no battery drain reports from beta testers |
| Copyright/legal exposure | Phase 0 - Pre-development | Written legal opinion obtained; snippet architecture reflects legal counsel's recommendations |

## Sources

- [ACRCloud Broadcast Monitoring Documentation](https://docs.acrcloud.com/tutorials/broadcast-monitoring-for-music) - Official setup, Timemap, callback configuration
- [ACRCloud Streams Results API](https://docs.acrcloud.com/reference/console-api/bm-projects/custom-streams-projects/streams-results) - Result data structure, fields, query parameters
- [ACRCloud Local Monitor (GitHub)](https://github.com/acrcloud/acrcloud_local_monitor) - Local monitoring tool, configuration, limitations
- [Radio Rabe ACR Webhook Receiver (GitHub)](https://github.com/radiorabe/acr-webhook-receiver) - Real-world ACRCloud webhook integration reference (archived)
- [FFmpeg Memory Leak in Continuous Streaming (Frigate Discussion)](https://github.com/blakeblackshear/frigate/discussions/11676) - FFmpeg memory leak patterns in 24/7 recording
- [FFmpeg MPEG-TS PCR Rollover Memory Leak (Ticket #11629)](https://trac.ffmpeg.org/ticket/11629) - 26.5-hour timestamp overflow bug
- [BAF: Audio Fingerprinting Dataset for Broadcast Monitoring (ISMIR 2022)](https://archives.ismir.net/ismir2022/paper/000109.pdf) - Accuracy analysis showing high precision but low recall with background music
- [S3 Object Overhead Optimization (AWS)](https://repost.aws/articles/ARrYlq-1h6SeexbiaYQQAGZg/s3-object-overhead-optimization) - Small object metadata overhead costs
- [PostgreSQL Partitioning for Time-Series (AWS Blog)](https://aws.amazon.com/blogs/database/designing-high-performance-time-series-data-tables-on-amazon-rds-for-postgresql/) - Partitioning strategies for high-volume time-series
- [WebSocket Architecture Best Practices (Ably)](https://ably.com/topic/websocket-architecture-best-practices) - Scaling WebSocket connections, iOS-specific challenges
- [WebSockets and iOS Challenges (Ably)](https://ably.com/topic/websockets-ios) - Background suspension, reconnection storms, battery drain
- [Romanian Copyright Law (WIPO)](https://www.wipo.int/wipolex/en/legislation/details/5195) - Law No. 8/1996 on Copyright and Neighboring Rights
- [EU Copyright Legislation](https://digital-strategy.ec.europa.eu/en/policies/copyright-legislation) - EU Directive 2019/790, no fair use equivalent

---
*Pitfalls research for: Music broadcast monitoring (24/7 radio/TV stream recognition with ACRCloud, 200+ Romanian streams, iOS client)*
*Researched: 2026-03-14*
