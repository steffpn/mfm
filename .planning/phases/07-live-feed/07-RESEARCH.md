# Phase 7: Live Feed - Research

**Researched:** 2026-03-16
**Domain:** Real-time event streaming (SSE), Redis pub/sub, iOS streaming client
**Confidence:** HIGH

## Summary

Phase 7 adds real-time detection streaming so users see new airplay detections appear within seconds of identification. The architecture is straightforward: the detection worker publishes to a Redis pub/sub channel after processing each callback, a new Fastify SSE route subscribes to that channel and pushes filtered events to connected clients, and the iOS app displays them in a dedicated Live tab using URLSession bytes streaming with manual SSE parsing.

The project already has Redis pub/sub infrastructure (`lib/pubsub.ts`) for station lifecycle events, ioredis for connections, and Fastify v5 with established route patterns. The iOS side already has `DetectionRowView`, `AudioPlayerManager`, and the `@Observable` + `.environment()` pattern. This phase layers SSE on top of existing infrastructure with minimal new dependencies.

**Primary recommendation:** Use `@fastify/sse` (v0.4.0, official Fastify plugin, supports `^5.x`) for the SSE route. On iOS, implement a lightweight manual SSE parser using `URLSession.bytes` (no third-party dependency) consistent with the project's zero-dependency iOS approach. Use Redis pub/sub (already in stack via ioredis) for event distribution, and a Redis sorted set for Last-Event-ID backfill replay.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- SSE (Server-Sent Events), not WebSocket -- one-way server-to-client is sufficient
- Detection worker publishes to a Redis pub/sub channel when new detections are processed
- Fastify SSE route subscribes to Redis channel and pushes events to connected clients
- JWT authentication via query parameter (?token=xxx) -- SSE EventSource API doesn't support custom headers
- Server-side filtering: read JWT claims and only push detections matching user's role/scope (consistent with Phase 5 pattern)
- Backfill on reconnect: client sends Last-Event-ID header, server replays missed events since that ID before switching to live stream
- New "Live" tab added to the tab bar (5 tabs total)
- Tab order: Dashboard, **Live**, Detections, Search, Settings -- Live is second position
- Tab icon: SF Symbol "waveform" with label "Live"
- No badge on the Live tab when detections arrive on other tabs
- New detections slide in from the top of the list (newest first)
- Reuse existing DetectionRowView from Phase 6 -- same compact row
- Snippet playback works identically via AudioPlayerManager (shared environment instance)
- Maximum 50 detections kept in the live feed -- older items drop off the bottom
- When user has scrolled down and new detection arrives: keep scroll position, show "New detections" pill/banner at top (Twitter/X-style)
- SSE connection stays alive ~30 seconds after app backgrounds; disconnect after timeout
- On foreground return: reconnect and backfill missed events via Last-Event-ID
- Subtle connection status indicator: small colored dot in nav bar area (green = connected, gray/red = disconnected)
- Empty state on first open: "Listening for detections..." centered message with subtle pulsing animation

### Claude's Discretion
- Exact Redis pub/sub channel naming and message format
- SSE event ID generation strategy (for Last-Event-ID replay)
- Reconnection backoff timing
- Exact animation timing for slide-in and "New detections" pill
- "Listening..." animation implementation details
- Network error retry strategy
- Memory management for the 50-item buffer

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LIVE-01 | User sees real-time detection feed via SSE | Redis pub/sub publish in detection worker -> @fastify/sse route -> URLSession.bytes SSE client on iOS. Full end-to-end SSE pipeline with backfill replay via Last-Event-ID. |
| LIVE-02 | Live feed filters by user's role and scope | Server-side filtering in SSE route handler: decode JWT from query param, filter Redis pub/sub events by role/scope before pushing to client. Reuses existing `CurrentUser` pattern from authenticate middleware. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @fastify/sse | 0.4.0 | SSE plugin for Fastify | Official Fastify plugin, peerDep `^5.x`, provides `reply.sse.send()` API with Last-Event-ID support |
| ioredis | 5.4.x | Redis pub/sub subscriber | Already in project for BullMQ; supports pub/sub with `subscribe()` and `on('message')` |
| URLSession.bytes | iOS 15+ | SSE byte stream client | Native Apple API, AsyncSequence of bytes, no third-party dependency needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @fastify/jwt | 10.0.0 | JWT verification for SSE auth | Already in project; verify token from query param in SSE route |
| @sinclair/typebox | 0.34.x | SSE route schema validation | Already in project; validate query parameters |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @fastify/sse | fastify-sse-v2 (v4.2.2) | Community plugin, supports fastify >=4; but @fastify/sse is official with better maintenance guarantee |
| @fastify/sse | Raw reply.hijack() | No dependency, but bypasses Fastify lifecycle hooks and requires manual header management |
| URLSession.bytes manual parsing | mattt/EventSource (v1.4.1) | Full spec compliance, but adds third-party dependency against project pattern |
| Redis pub/sub | Redis Streams (XREAD) | Built-in replay via XRANGE, but adds complexity; pub/sub + sorted set backfill is simpler for this use case |

**Installation:**
```bash
cd apps/api && pnpm add @fastify/sse
```

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
  lib/
    pubsub.ts             # ADD: CHANNELS.DETECTION_NEW, DetectionEvent type, publishDetectionEvent()
  routes/v1/
    live-feed/
      index.ts            # SSE route plugin: GET /v1/live-feed?token=xxx
      schema.ts           # Query schema (token param)
  workers/
    detection.ts          # MODIFY: add Redis PUBLISH after AirplayEvent creation/extension

apps/ios/myFuckingMusic/
  Services/
    SSEClient.swift       # NEW: URLSession.bytes SSE parser + connection manager
  ViewModels/
    LiveFeedViewModel.swift  # NEW: @Observable, 50-item buffer, scroll state
  Views/
    LiveFeed/
      LiveFeedView.swift     # NEW: List with DetectionRowView, connection indicator, empty state
      NewDetectionsPill.swift # NEW: "New detections" overlay pill
    MainTabView.swift        # MODIFY: add Live tab in position 2
```

### Pattern 1: Redis Pub/Sub for Detection Broadcasting
**What:** Detection worker publishes a JSON event to a Redis pub/sub channel after processing each new AirplayEvent. The SSE route subscribes to this channel and fans out to connected clients.
**When to use:** Whenever a new AirplayEvent is created (not when extending an existing one -- a new detection means new content for the live feed).
**Example:**
```typescript
// lib/pubsub.ts - Extended with detection channel
export const CHANNELS = {
  STATION_ADDED: "station:added",
  STATION_REMOVED: "station:removed",
  STATION_UPDATED: "station:updated",
  DETECTION_NEW: "detection:new",  // NEW
} as const;

export interface LiveDetectionEvent {
  id: number;           // AirplayEvent.id -- used as SSE event ID
  stationId: number;
  songTitle: string;
  artistName: string;
  isrc: string | null;
  snippetUrl: string | null;
  stationName: string;
  startedAt: string;    // ISO 8601
  publishedAt: string;  // ISO 8601 -- when event was published
}
```

### Pattern 2: SSE Route with JWT Query Parameter Auth
**What:** SSE endpoint authenticates via `?token=xxx` query parameter since the browser EventSource API and URLSession don't support custom headers on streaming GET requests. The handler verifies the JWT, loads user scopes, subscribes to Redis pub/sub, and filters events server-side.
**When to use:** For the `/v1/live-feed` endpoint.
**Example:**
```typescript
// routes/v1/live-feed/index.ts
import type { FastifyPluginAsync } from "fastify";

const liveFeedRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", { sse: true }, async (request, reply) => {
    const token = (request.query as { token?: string }).token;
    if (!token) return reply.code(401).send({ error: "Token required" });

    // Verify JWT manually (can't use authenticate middleware for query-param auth)
    let payload: { sub: number };
    try {
      payload = fastify.jwt.verify(token) as { sub: number };
    } catch {
      return reply.code(401).send({ error: "Invalid token" });
    }

    // Load user + scopes for filtering
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { scopes: true },
    });
    if (!user || !user.isActive) {
      return reply.code(401).send({ error: "Invalid token" });
    }

    // Handle Last-Event-ID backfill
    const lastEventId = reply.sse.lastEventId;
    if (lastEventId) {
      // Replay missed events from Redis sorted set
      const missed = await replayMissedEvents(parseInt(lastEventId, 10), user);
      for (const event of missed) {
        await reply.sse.send({ id: String(event.id), event: "detection", data: JSON.stringify(event) });
      }
    }

    // Subscribe to Redis pub/sub and filter for this user
    const subscriber = createRedisConnection();
    await subscriber.subscribe(CHANNELS.DETECTION_NEW);

    subscriber.on("message", async (_channel: string, message: string) => {
      const event: LiveDetectionEvent = JSON.parse(message);
      if (shouldDeliverToUser(event, user)) {
        await reply.sse.send({ id: String(event.id), event: "detection", data: message });
      }
    });

    reply.sse.onClose(() => {
      subscriber.unsubscribe();
      subscriber.disconnect();
    });

    reply.sse.keepAlive();
  });
};
```

### Pattern 3: Manual SSE Parser on iOS with URLSession.bytes
**What:** A lightweight SSE client that uses `URLSession.shared.bytes(for:)` to open a streaming connection, parses SSE frames line-by-line, and yields decoded `AirplayEvent` objects.
**When to use:** For the iOS SSE connection to the live feed endpoint.
**Example:**
```swift
// Services/SSEClient.swift
actor SSEClient {
    private var task: Task<Void, Never>?
    private var lastEventId: String?

    func connect(baseURL: URL, token: String) -> AsyncStream<AirplayEvent> {
        AsyncStream { continuation in
            task = Task {
                var url = baseURL.appendingPathComponent("live-feed")
                var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
                components.queryItems = [URLQueryItem(name: "token", value: token)]

                var request = URLRequest(url: components.url!)
                if let lastId = lastEventId {
                    request.setValue(lastId, forHTTPHeaderField: "Last-Event-ID")
                }

                do {
                    let (bytes, response) = try await URLSession.shared.bytes(for: request)
                    guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                        continuation.finish()
                        return
                    }

                    var currentId: String?
                    var currentData: String?
                    var currentEvent: String?

                    for try await line in bytes.lines {
                        if line.hasPrefix("id:") {
                            currentId = String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                        } else if line.hasPrefix("event:") {
                            currentEvent = String(line.dropFirst(6)).trimmingCharacters(in: .whitespaces)
                        } else if line.hasPrefix("data:") {
                            currentData = String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                        } else if line.isEmpty {
                            // Empty line = end of event
                            if let data = currentData, currentEvent == "detection" {
                                if let id = currentId { lastEventId = id }
                                if let eventData = data.data(using: .utf8),
                                   let event = try? JSONDecoder.apiDecoder.decode(AirplayEvent.self, from: eventData) {
                                    continuation.yield(event)
                                }
                            }
                            currentId = nil
                            currentData = nil
                            currentEvent = nil
                        }
                    }
                } catch {
                    // Connection dropped -- continuation finishes, reconnect logic in ViewModel
                }
                continuation.finish()
            }
        }
    }

    func disconnect() {
        task?.cancel()
        task = nil
    }
}
```

### Pattern 4: Event ID Strategy with Redis Sorted Set Backfill
**What:** Use the AirplayEvent database ID as the SSE event ID (monotonically increasing integer). Store recent events in a Redis sorted set (score = event ID) for fast backfill on reconnect. Trim to last 200 events to bound memory.
**When to use:** For Last-Event-ID replay and reconnection backfill.
**Example:**
```typescript
// In detection worker, after creating new AirplayEvent:
const BACKFILL_KEY = "live-feed:recent";
const BACKFILL_MAX = 200;

// Store event for backfill replay
await redis.zadd(BACKFILL_KEY, newEvent.id, JSON.stringify(liveEvent));
// Trim to keep only last BACKFILL_MAX events
await redis.zremrangebyrank(BACKFILL_KEY, 0, -(BACKFILL_MAX + 1));

// In SSE route, for replay:
async function replayMissedEvents(lastId: number, user: CurrentUser): Promise<LiveDetectionEvent[]> {
  const raw = await redis.zrangebyscore(BACKFILL_KEY, lastId + 1, "+inf");
  return raw
    .map((s) => JSON.parse(s) as LiveDetectionEvent)
    .filter((e) => shouldDeliverToUser(e, user));
}
```

### Pattern 5: Role-Based Server-Side Filtering
**What:** Filter detection events on the server before pushing to SSE clients. Each connected client has their user loaded with scopes. Events are checked against the user's role and scope before being sent.
**When to use:** Every event received from Redis pub/sub is filtered before relay to SSE client.
**Example:**
```typescript
function shouldDeliverToUser(event: LiveDetectionEvent, user: CurrentUser): boolean {
  if (user.role === "ADMIN") return true;

  if (user.role === "STATION") {
    const stationIds = user.scopes
      .filter((s) => s.entityType === "STATION")
      .map((s) => s.entityId);
    return stationIds.includes(event.stationId);
  }

  // ARTIST / LABEL: allow all if they have any scope
  // (same as existing airplay-events handler -- refined when entity models added)
  return user.scopes.length > 0;
}
```

### Anti-Patterns to Avoid
- **Creating a new Redis connection per SSE event:** Create ONE subscriber connection per SSE client, not per message. Use the connection's `on('message')` callback.
- **Storing backfill in PostgreSQL:** The backfill is ephemeral (last 200 events). Redis sorted set is the right data structure -- fast reads, auto-trimming, no schema changes needed.
- **Polling instead of streaming:** URLSession.bytes with AsyncSequence is a true streaming connection. Do not implement a polling timer hitting a REST endpoint.
- **Sending all events to client and filtering client-side:** Server-side filtering is a locked decision. Never send events the user shouldn't see.
- **Using Background URLSession for SSE:** Background URLSession is for discrete transfers, not long-lived streams. Use a regular URLSession with app lifecycle management (connect/disconnect on foreground/background).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE framing (server) | Manual `reply.raw.write("data: ...")` | @fastify/sse `reply.sse.send()` | Handles heartbeat, event formatting, connection lifecycle, Last-Event-ID header parsing |
| SSE parsing (iOS) | N/A - hand-roll is fine here | Manual line parser with URLSession.bytes | SSE wire format is simple (4 field types + blank line separator). A 50-line parser avoids a dependency. Project pattern is zero third-party iOS deps. |
| Backfill event store | Custom DB table for event replay | Redis sorted set (ZADD/ZRANGEBYSCORE) | Ephemeral data, bounded size, fast range queries. No migration needed. |
| Reconnection backoff | Custom timer logic | Exponential backoff with jitter (simple formula) | Standard pattern: `min(baseDelay * 2^attempt + jitter, maxDelay)` |

**Key insight:** The server side benefits from @fastify/sse to handle SSE protocol details (heartbeat, framing, connection tracking). The iOS side is simple enough that manual parsing is the right choice given the project's zero-dependency approach.

## Common Pitfalls

### Pitfall 1: Redis Pub/Sub Subscriber Blocks Other Commands
**What goes wrong:** A Redis connection in subscribe mode cannot execute other commands (GET, SET, ZADD). Attempting to do so throws an error.
**Why it happens:** Redis protocol limitation -- subscriber mode is exclusive.
**How to avoid:** Create a SEPARATE Redis connection for each SSE client's pub/sub subscription. Use the existing `createRedisConnection()` factory (already in lib/redis.ts).
**Warning signs:** "ERR only (P)SUBSCRIBE / (P)UNSUBSCRIBE / PING / QUIT are allowed in this context"

### Pitfall 2: Redis Connection Leak on SSE Disconnect
**What goes wrong:** If the client disconnects (network drop, app background) and the Redis subscriber connection isn't cleaned up, connections accumulate until Redis maxclients is hit.
**Why it happens:** SSE connection close events aren't always handled.
**How to avoid:** Use `reply.sse.onClose()` callback to unsubscribe and disconnect the Redis subscriber. Also implement a server-side keepalive/heartbeat -- @fastify/sse does this by default (30s interval).
**Warning signs:** Redis `INFO clients` shows growing connected_clients count over time.

### Pitfall 3: JWT Expiry During Long-Lived SSE Connection
**What goes wrong:** JWT access tokens expire (1h in this project). If the SSE connection lasts longer than the token TTL, the user remains connected with an expired token.
**Why it happens:** JWT is only verified at connection time, not per-event.
**How to avoid:** Accept this trade-off for v1. The SSE connection is bounded by app backgrounding (~30s) and network disruptions. On reconnect, a fresh token is used. If stricter enforcement is needed later, add periodic re-verification or use short-lived connection windows.
**Warning signs:** User with revoked access still receives events on an old connection.

### Pitfall 4: ScrollView Position Jump on New Item Insert
**What goes wrong:** When new items are inserted at the top of a SwiftUI List, the scroll position jumps unpredictably.
**Why it happens:** SwiftUI's List doesn't anchor scroll position by default when items are prepended.
**How to avoid:** Track whether user is at top of list. If at top, let new items appear (auto-scroll). If scrolled down, don't modify visible content -- instead increment a counter and show the "New detections" pill. Use `ScrollViewReader` with `scrollTo()` when pill is tapped.
**Warning signs:** List content jumps around when new events arrive while user is reading older events.

### Pitfall 5: URLSession.bytes Task Not Cancelled on View Disappear
**What goes wrong:** The streaming task continues running even after the user navigates away from the Live tab, consuming bandwidth and battery.
**Why it happens:** Swift Task isn't automatically cancelled when the view disappears.
**How to avoid:** Use `.task { }` modifier on the view which auto-cancels on disappear, or explicitly manage the Task lifecycle in the ViewModel with `.onDisappear { viewModel.disconnect() }`. For app backgrounding, use `scenePhase` environment value.
**Warning signs:** Network activity continues when Live tab is not visible.

### Pitfall 6: SSE Connection Floods After Mass Detection
**What goes wrong:** If 200 stations all detect songs simultaneously, a single SSE client could receive a burst of events that overwhelms the UI.
**Why it happens:** Redis pub/sub delivers all messages immediately.
**How to avoid:** The 50-item buffer naturally handles this -- excess items drop off. The server-side role filtering also reduces volume (STATION users only see their stations' detections). For ADMIN users seeing all 200+ stations, consider adding a per-connection rate limiter or batch events into 1-second windows if needed.
**Warning signs:** UI lag or animation stuttering during high-detection periods.

## Code Examples

### Detection Worker Publish (Backend)
```typescript
// In detection.ts processCallback(), after creating a new AirplayEvent:
import { redis } from "../lib/redis.js";
import { CHANNELS, type LiveDetectionEvent } from "../lib/pubsub.js";

// After: const newEvent = await prisma.airplayEvent.create(...)
// Load station name for the live event
const station = await prisma.station.findUnique({
  where: { id: station.id },
  select: { name: true },
});

const liveEvent: LiveDetectionEvent = {
  id: newEvent.id,
  stationId: newEvent.stationId,
  songTitle: newEvent.songTitle,
  artistName: newEvent.artistName,
  isrc: newEvent.isrc,
  snippetUrl: newEvent.snippetUrl,
  stationName: station?.name ?? "Unknown",
  startedAt: newEvent.startedAt.toISOString(),
  publishedAt: new Date().toISOString(),
};

// Publish to Redis pub/sub (best-effort, non-blocking)
redis.publish(CHANNELS.DETECTION_NEW, JSON.stringify(liveEvent)).catch((err) => {
  logger.error({ err }, "Failed to publish detection event");
});

// Store in backfill sorted set
const BACKFILL_KEY = "live-feed:recent";
await redis.zadd(BACKFILL_KEY, newEvent.id, JSON.stringify(liveEvent));
await redis.zremrangebyrank(BACKFILL_KEY, 0, -(201)); // Keep last 200
```

### LiveFeedViewModel (iOS)
```swift
@MainActor
@Observable
final class LiveFeedViewModel {
    var events: [AirplayEvent] = []
    var connectionState: ConnectionState = .disconnected
    var newEventCount = 0  // Events arrived while scrolled away
    var isAtTop = true     // Track scroll position

    private let sseClient = SSEClient()
    private let maxEvents = 50

    enum ConnectionState {
        case connected, disconnected, reconnecting
    }

    func connect(authManager: AuthManager) async {
        guard let token = KeychainHelper.read(key: "accessToken") else { return }
        connectionState = .connected

        let baseURL = URL(string: "http://localhost:3000/api/v1")!
        let stream = await sseClient.connect(baseURL: baseURL, token: token)

        for await event in stream {
            if isAtTop {
                withAnimation(.easeInOut(duration: 0.3)) {
                    events.insert(event, at: 0)
                    if events.count > maxEvents {
                        events.removeLast(events.count - maxEvents)
                    }
                }
            } else {
                events.insert(event, at: 0)
                if events.count > maxEvents {
                    events.removeLast(events.count - maxEvents)
                }
                newEventCount += 1
            }
        }

        // Stream ended -- connection lost
        connectionState = .disconnected
    }

    func scrollToTop() {
        newEventCount = 0
    }
}
```

### Tab Bar Update (iOS)
```swift
// MainTabView.swift -- add Live tab in second position
TabView {
    NavigationStack { DashboardView() }
        .tabItem { Label("Dashboard", systemImage: "house.fill") }

    NavigationStack { LiveFeedView() }
        .tabItem { Label("Live", systemImage: "waveform") }

    DetectionsView()
        .tabItem { Label("Detections", systemImage: "list.bullet") }

    SearchView()
        .tabItem { Label("Search", systemImage: "magnifyingglass") }

    NavigationStack { SettingsView() }
        .tabItem { Label("Settings", systemImage: "gear") }
}
```

### Connection Lifecycle with ScenePhase (iOS)
```swift
// LiveFeedView.swift
struct LiveFeedView: View {
    @State private var viewModel = LiveFeedViewModel()
    @Environment(AuthManager.self) private var authManager
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        // ... list content ...
        .task { await viewModel.connect(authManager: authManager) }
        .onChange(of: scenePhase) { _, newPhase in
            switch newPhase {
            case .background:
                // Start 30-second timer before disconnect
                viewModel.scheduleDisconnect(after: 30)
            case .active:
                // Cancel timer and reconnect if needed
                viewModel.cancelScheduledDisconnect()
                if viewModel.connectionState == .disconnected {
                    Task { await viewModel.reconnect(authManager: authManager) }
                }
            default: break
            }
        }
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| EventSource browser API (JS-only) | URLSession.bytes with AsyncSequence (Swift) | iOS 15 / WWDC 2021 | Native streaming without third-party deps |
| Manual reply.raw.write() SSE | @fastify/sse official plugin | 2025 (v0.1.0+) | Proper connection lifecycle, heartbeat, Last-Event-ID |
| WebSocket for all real-time | SSE for server-to-client unidirectional | Always (SSE spec since 2015) | Simpler protocol, auto-reconnect, HTTP-compatible |
| Redis SUBSCRIBE with callback | Same pattern, still standard | Stable | ioredis pub/sub API unchanged; separate connection required for subscriber |

**Deprecated/outdated:**
- `fastify-sse` (lolo32): Unmaintained, replaced by `fastify-sse-v2` and `@fastify/sse`
- `IKEventSource` (CocoaPod): Pre-Swift-concurrency SSE library; URLSession.bytes is the modern replacement
- `ObservableObject` / `@Published`: Project uses `@Observable` macro (iOS 17+)

## Open Questions

1. **@fastify/sse v0.4.0 maturity**
   - What we know: Official Fastify plugin, supports `^5.x`, has `reply.sse.send()`, `reply.sse.onClose()`, `reply.sse.lastEventId`, heartbeat
   - What's unclear: v0.4.0 is pre-1.0 -- API may be less battle-tested than fastify-sse-v2 (v4.2.2)
   - Recommendation: Use @fastify/sse since it's the official plugin and has the needed API. If issues arise during implementation, fall back to fastify-sse-v2 (also supports Fastify v5) or raw `reply.hijack()` approach. The SSE wire format is simple enough that switching is low-cost.

2. **Redis pub/sub message ordering guarantee**
   - What we know: Redis pub/sub delivers messages in order within a single publisher. Multiple detection worker instances could publish concurrently.
   - What's unclear: With BullMQ concurrency=10, multiple jobs may create AirplayEvents and publish near-simultaneously.
   - Recommendation: Accept eventual ordering -- events have timestamps and IDs. The live feed is newest-first, so minor ordering variations are invisible to users.

3. **Backfill sorted set vs. database query**
   - What we know: Redis sorted set is fast for range queries and auto-bounded. Database query would be consistent but slower.
   - What's unclear: Whether sorted set entries survive Redis restart (they do if persistence is enabled, but this project may not have AOF/RDB configured).
   - Recommendation: Use Redis sorted set as primary. If Redis restarts, backfill is simply empty (best-effort per SSE spec). Events are still in the database for historical viewing in the Detections tab.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.0.x |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `cd apps/api && pnpm test` |
| Full suite command | `cd apps/api && pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIVE-01 | SSE route returns text/event-stream with detection events | integration | `cd apps/api && pnpm vitest run tests/routes/live-feed.test.ts -x` | Wave 0 |
| LIVE-01 | Detection worker publishes to Redis pub/sub after new AirplayEvent | unit | `cd apps/api && pnpm vitest run tests/workers/detection.test.ts -x` | Exists (extend) |
| LIVE-01 | SSE route replays missed events when Last-Event-ID provided | integration | `cd apps/api && pnpm vitest run tests/routes/live-feed.test.ts -x` | Wave 0 |
| LIVE-02 | ADMIN user receives all events, STATION user receives only scoped | integration | `cd apps/api && pnpm vitest run tests/routes/live-feed.test.ts -x` | Wave 0 |
| LIVE-02 | shouldDeliverToUser filtering logic | unit | `cd apps/api && pnpm vitest run tests/lib/live-feed-filter.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/api && pnpm test`
- **Per wave merge:** `cd apps/api && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/routes/live-feed.test.ts` -- covers SSE route, auth, filtering, backfill (LIVE-01, LIVE-02)
- [ ] `tests/lib/live-feed-filter.test.ts` -- unit tests for shouldDeliverToUser function (LIVE-02)
- [ ] Extend `tests/workers/detection.test.ts` -- verify Redis PUBLISH call after AirplayEvent creation (LIVE-01)

Note: iOS SSE client and LiveFeedView are manual-test only (no XCTest infrastructure in project). Validate via simulator.

## Sources

### Primary (HIGH confidence)
- npm registry: `@fastify/sse` v0.4.0, peerDependencies `{ fastify: '^5.x' }` -- verified via `npm view`
- npm registry: `fastify-sse-v2` v4.2.2, peerDependencies `{ fastify: '>=4' }` -- verified via `npm view`
- Project codebase: `lib/pubsub.ts`, `lib/redis.ts`, `workers/detection.ts`, `middleware/authenticate.ts` -- read directly
- Project codebase: `MainTabView.swift`, `APIClient.swift`, `DetectionRowView.swift`, `AuthManager.swift` -- read directly
- [Apple URLSession.AsyncBytes docs](https://developer.apple.com/documentation/foundation/urlsession/asyncbytes)

### Secondary (MEDIUM confidence)
- [GitHub fastify/sse](https://github.com/fastify/sse) -- official SSE plugin README with API docs
- [GitHub fastify-sse-v2](https://github.com/mpetrunic/fastify-sse-v2) -- async generator pattern documentation
- [GitHub mattt/EventSource](https://github.com/mattt/EventSource) -- Swift SSE library (v1.4.1, reference implementation for SSE spec)
- [ioredis npm](https://www.npmjs.com/package/ioredis) -- pub/sub documentation
- [Artera SSE Architecture](https://innovation.artera.io/blog/our-journey-to-a-scalable-sse-architecture/) -- Redis-backed SSE backfill pattern

### Tertiary (LOW confidence)
- @fastify/sse v0.4.0 pre-1.0 API stability -- needs validation during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- @fastify/sse verified compatible with Fastify ^5.x, ioredis pub/sub pattern well-documented, URLSession.bytes is native Apple API
- Architecture: HIGH -- Follows existing project patterns (Fastify plugins, Redis pub/sub in pubsub.ts, @Observable + .environment() on iOS)
- Pitfalls: HIGH -- Redis subscriber isolation, connection cleanup, JWT expiry, scroll position issues are well-documented concerns in SSE architectures

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable domain, 30 days)
