---
phase: 07-live-feed
verified: 2026-03-16T14:00:00Z
status: human_needed
score: 18/18 must-haves verified
re_verification: false
human_verification:
  - test: "End-to-end SSE streaming with live backend"
    expected: "New detections slide in from the top within seconds of ACRCloud identification"
    why_human: "Requires live backend, real Redis pub/sub, and ACRCloud callbacks -- cannot verify programmatically"
  - test: "Live tab visual appearance and tab bar position"
    expected: "Live tab appears in second position with waveform SF Symbol icon between Dashboard and Detections"
    why_human: "Visual/UI verification requires running the iOS app in a simulator or device"
  - test: "Empty state pulsing animation"
    expected: "Waveform symbol shows repeating variableColor animation when connected but no events received"
    why_human: "Animation behavior requires a running iOS Simulator to observe"
  - test: "New detections pill behavior while scrolled down"
    expected: "Pill appears at top when new events arrive while scrolled down; scroll position does NOT jump; tapping pill scrolls to top and dismisses pill"
    why_human: "Scroll position preservation and pill interaction require live UI testing"
  - test: "Background/foreground SSE lifecycle"
    expected: "Connection disconnects ~30 seconds after app backgrounds; on foreground return, connection status briefly shows orange then green; missed events backfill into feed"
    why_human: "Requires running app with background/foreground transitions and verifiable SSE reconnect"
  - test: "Role-based event filtering in live feed"
    expected: "STATION user only sees detections from their scoped stations; ADMIN sees all"
    why_human: "Requires multiple user accounts with different scopes and live event flow to verify filtering"
---

# Phase 07: Live Feed Verification Report

**Phase Goal:** Real-time Live Feed -- SSE endpoint streaming new detections to the iOS app with connection lifecycle management
**Verified:** 2026-03-16T14:00:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

#### Plan 07-01 Truths (Backend SSE Infrastructure)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Detection worker publishes LiveDetectionEvent to Redis pub/sub after new AirplayEvent creation | VERIFIED | `detection.ts` lines 262-289: try/catch block calling `redis.publish(CHANNELS.DETECTION_NEW, JSON.stringify(liveEvent))` immediately after `prisma.airplayEvent.create()` |
| 2 | Detection worker stores recent events in Redis sorted set for backfill replay | VERIFIED | `detection.ts` lines 278-283: `redis.zadd(BACKFILL_KEY, newEvent.id, ...)` + `redis.zremrangebyrank(BACKFILL_KEY, 0, -(BACKFILL_MAX + 1))` bounding to 200 |
| 3 | SSE route at GET /v1/live-feed authenticates via ?token= query parameter | VERIFIED | `routes/v1/live-feed/index.ts` lines 40-53: extracts `request.query?.token`, returns 401 if missing, verifies via `fastify.jwt.verify(token)` |
| 4 | SSE route subscribes to Redis pub/sub and streams filtered events to client | VERIFIED | `index.ts` lines 112-131: `createRedisConnection()`, `subscriber.subscribe(CHANNELS.DETECTION_NEW)`, `subscriber.on("message", ...)` with `reply.sse.send()` |
| 5 | SSE route replays missed events when Last-Event-ID header is provided | VERIFIED | `index.ts` lines 85-109: `reply.sse.replay()` callback reads `redis.zrangebyscore(BACKFILL_KEY, lastId + 1, "+inf")`, filters and sends |
| 6 | ADMIN user receives all events; STATION user receives only scoped station events | VERIFIED | `live-feed-filter.ts` lines 24-31: ADMIN returns true unconditionally; STATION filters by `entityType === "STATION"` scopes matching `event.stationId` |
| 7 | ARTIST/LABEL user receives events if they have any scope entry | VERIFIED | `live-feed-filter.ts` line 36: `return user.scopes.length > 0` for all non-ADMIN/non-STATION roles |

#### Plan 07-02 Truths (iOS Live Feed)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 8 | User sees a Live tab in second position in the tab bar with waveform icon | VERIFIED (code) | `MainTabView.swift` lines 18-21: `LiveFeedView()` with `Label("Live", systemImage: "waveform")` in second position between Dashboard and Detections; human confirmation needed |
| 9 | Live tab shows "Listening for detections..." empty state with pulsing animation when no events have arrived | VERIFIED (code) | `LiveFeedView.swift` lines 63-76: `Image(systemName: "waveform").symbolEffect(.variableColor.iterative, options: .repeating)` + `Text("Listening for detections...")` shown when `events.isEmpty && connectionState != .disconnected` |
| 10 | New detections slide in from the top of the list within seconds of identification | VERIFIED (code) | `LiveFeedViewModel.swift` lines 56-61: `withAnimation(.easeInOut(duration: 0.3)) { events.insert(event, at: 0) }` when `isAtTop == true`; live streaming latency needs human verification |
| 11 | Live feed shows existing DetectionRowView with song title, artist, station, timestamp, play button | VERIFIED | `LiveFeedView.swift` line 103: `DetectionRowView(event: event)` reused inside ForEach |
| 12 | Snippet playback works in live feed via shared AudioPlayerManager | VERIFIED | `LiveFeedView.swift` line 8: `@Environment(AudioPlayerManager.self) private var audioPlayer` passed to environment; DetectionRowView uses it via `@Environment(AudioPlayerManager.self)` |
| 13 | Maximum 50 detections kept in buffer | VERIFIED | `LiveFeedViewModel.swift` line 16: `private let maxEvents = 50`; lines 58-65: `events.removeLast(events.count - maxEvents)` applied in both `isAtTop` and scrolled-down paths |
| 14 | When scrolled down and new detection arrives, a "New detections" pill appears at top | VERIFIED (code) | `LiveFeedView.swift` lines 22-29: `if viewModel.newEventCount > 0 { NewDetectionsPill(...) }`; `LiveFeedViewModel.swift` line 67: `newEventCount += 1` when `!isAtTop` |
| 15 | Tapping "New detections" pill scrolls to top and dismisses pill | VERIFIED (code) | `LiveFeedView.swift` lines 23-25 + 184-190: pill `onTap` calls `scrollToTop()` which sets `scrollTarget = firstId` and calls `viewModel.scrollToTop()` resetting counter |
| 16 | Connection status indicator shows green/gray dot | VERIFIED | `LiveFeedView.swift` lines 135-157: `Circle().fill(connectionColor)` where `connectionColor` returns `.green` for `.connected`, `.gray` for `.disconnected`, `.orange` for `.connecting/.reconnecting` |
| 17 | SSE connection disconnects ~30 seconds after app backgrounds | VERIFIED (code) | `LiveFeedView.swift` lines 170-171: `.background` ScenePhase calls `viewModel.scheduleDisconnect(after: 30)` |
| 18 | On foreground return, connection reconnects and backfills missed events via Last-Event-ID | VERIFIED (code) | `LiveFeedView.swift` lines 173-176: `.active` phase cancels disconnect, calls `viewModel.reconnect(token:)`; `SSEClient.swift` lines 80-83: `Last-Event-ID` header sent from `lastEventId` if set |

**Score:** 18/18 truths verified (6 require human confirmation for live behavior)

---

## Required Artifacts

### Plan 07-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/lib/pubsub.ts` | CHANNELS.DETECTION_NEW, LiveDetectionEvent type, BACKFILL_KEY | VERIFIED | All present: `DETECTION_NEW: "detection:new"`, `LiveDetectionEvent` interface with all 9 fields, `BACKFILL_KEY = "live-feed:recent"`, `BACKFILL_MAX = 200` |
| `apps/api/src/lib/live-feed-filter.ts` | shouldDeliverToUser filtering function | VERIFIED | Exports `shouldDeliverToUser(event, user): boolean`; 37 lines; ADMIN/STATION/ARTIST/LABEL logic all implemented |
| `apps/api/src/workers/detection.ts` | Redis PUBLISH after AirplayEvent creation + backfill sorted set | VERIFIED | Lines 262-289: publish + zadd + zremrangebyrank in try/catch block after `prisma.airplayEvent.create()`, best-effort |
| `apps/api/src/routes/v1/live-feed/index.ts` | SSE route plugin with JWT query param auth, Redis pub/sub, backfill replay | VERIFIED | 145 lines; exports default; all wiring present; uses `reply.hijack()` + `reply.sse.sendHeaders()` + `reply.sse.replay()` |
| `apps/api/src/routes/v1/live-feed/schema.ts` | TypeBox query schema for token parameter | VERIFIED | Exports `LiveFeedQuerySchema` and `LiveFeedQuery` type |
| `apps/api/tests/lib/live-feed-filter.test.ts` | Unit tests for shouldDeliverToUser, min 40 lines | VERIFIED | 117 lines; 8 test cases covering all roles |
| `apps/api/tests/routes/live-feed.test.ts` | Integration tests for SSE route, min 60 lines | VERIFIED | 229 lines; 6 tests with real HTTP connections via `app.listen()` |

### Plan 07-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/ios/myFuckingMusic/Services/SSEClient.swift` | Actor-based SSE client, min 50 lines | VERIFIED | 193 lines; actor with `connect()` returning `AsyncStream<AirplayEvent>`, `disconnect()`, `lastEventId` tracking, SSE frame parser |
| `apps/ios/myFuckingMusic/ViewModels/LiveFeedViewModel.swift` | @Observable ViewModel with 50-item buffer, scroll state, connection lifecycle, min 80 lines | VERIFIED | 134 lines; `@MainActor @Observable`; `maxEvents = 50`; `isAtTop`, `newEventCount`, `connectionState`; connect/reconnect/disconnect/scheduleDisconnect/cancelScheduledDisconnect |
| `apps/ios/myFuckingMusic/Views/LiveFeed/LiveFeedView.swift` | Live feed list with DetectionRowView, connection indicator, empty state, min 60 lines | VERIFIED | 191 lines; all three states (empty/disconnected/events); ScrollViewReader; connectionIndicator in toolbar; scenePhase handling |
| `apps/ios/myFuckingMusic/Views/LiveFeed/NewDetectionsPill.swift` | "New detections" overlay pill, min 15 lines | VERIFIED | 26 lines; blue Capsule with arrow.up icon and count text; onTap callback |
| `apps/ios/myFuckingMusic/Views/MainTabView.swift` | Updated tab bar with Live tab; contains "waveform" | VERIFIED | `LiveFeedView()` in second position with `Label("Live", systemImage: "waveform")` |

---

## Key Link Verification

### Plan 07-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/api/src/workers/detection.ts` | `apps/api/src/lib/pubsub.ts` | `redis.publish(CHANNELS.DETECTION_NEW, ...)` | WIRED | Lines 274-276: `await redis.publish(CHANNELS.DETECTION_NEW, JSON.stringify(liveEvent))` |
| `apps/api/src/routes/v1/live-feed/index.ts` | `apps/api/src/lib/pubsub.ts` | `subscriber.subscribe(CHANNELS.DETECTION_NEW)` | WIRED | Line 113: `await subscriber.subscribe(CHANNELS.DETECTION_NEW)` |
| `apps/api/src/routes/v1/live-feed/index.ts` | `apps/api/src/lib/live-feed-filter.ts` | `shouldDeliverToUser(event, user)` | WIRED | Lines 98 + 121: called in both backfill replay and live message handler |
| `apps/api/src/routes/v1/index.ts` | `apps/api/src/routes/v1/live-feed/index.ts` | `fastify.register(import('./live-feed/index.js'))` | WIRED | Lines 21-23: `fastify.register(import("./live-feed/index.js"), { prefix: "/live-feed" })` |

### Plan 07-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/ios/myFuckingMusic/Services/SSEClient.swift` | `/api/v1/live-feed?token=xxx` | `URLSession.shared.bytes(for:)` streaming | WIRED | Line 67: `baseURL.appendingPathComponent("v1/live-feed")` with token query item; line 86: `URLSession.shared.bytes(for: request)` |
| `apps/ios/myFuckingMusic/ViewModels/LiveFeedViewModel.swift` | `apps/ios/myFuckingMusic/Services/SSEClient.swift` | `sseClient.connect() -> AsyncStream<AirplayEvent>` | WIRED | Line 44: `await sseClient.connect(baseURL: apiRoot, token: token, ...)`; line 52: `for await event in stream` |
| `apps/ios/myFuckingMusic/Views/LiveFeed/LiveFeedView.swift` | `apps/ios/myFuckingMusic/ViewModels/LiveFeedViewModel.swift` | `@State viewModel property` | WIRED | Line 7: `@State private var viewModel = LiveFeedViewModel()`; used throughout |
| `apps/ios/myFuckingMusic/Views/LiveFeed/LiveFeedView.swift` | `apps/ios/myFuckingMusic/Views/Detections/DetectionRowView.swift` | `ForEach reusing DetectionRowView` | WIRED | Line 103: `DetectionRowView(event: event)` inside ForEach |
| `apps/ios/myFuckingMusic/Views/MainTabView.swift` | `apps/ios/myFuckingMusic/Views/LiveFeed/LiveFeedView.swift` | `TabView tab item` | WIRED | Line 18: `LiveFeedView()` as second tab item |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LIVE-01 | 07-01, 07-02 | User sees real-time detection feed via WebSocket/SSE | SATISFIED | SSE endpoint at GET /v1/live-feed streaming LiveDetectionEvents; iOS SSEClient + LiveFeedView displaying them in real time |
| LIVE-02 | 07-01, 07-02 | Live feed filters by user's role and scope | SATISFIED | `shouldDeliverToUser()` filters on server side (ADMIN=all, STATION=scoped stationIds, ARTIST/LABEL=any scope); applied in both backfill replay and live message handler |

No orphaned requirements found for Phase 07.

---

## Anti-Patterns Found

None detected. Scanned all 7 created/modified backend files and 5 created/modified iOS files for TODO/FIXME/HACK/placeholder comments, empty implementations, stub returns, and console.log-only handlers.

Notable: The ARTIST/LABEL filtering defers entity model scoping (returns true for any scopes present), but this is explicitly documented as intentional -- matching the established pattern from Phase 5 airplay-events handler. Not a stub.

---

## Human Verification Required

### 1. End-to-End SSE Streaming

**Test:** Start the backend (`cd apps/api && pnpm dev`), open the iOS app in Simulator, navigate to the Live tab, then trigger an ACRCloud webhook detection (or use a test callback)
**Expected:** The new detection appears in the live feed list within 1-3 seconds, sliding in from the top with animation
**Why human:** Requires live backend with Redis, real ACRCloud callbacks or test fixture, and running iOS Simulator

### 2. Live Tab Visual Appearance and Position

**Test:** Run the iOS app and observe the tab bar
**Expected:** 5 tabs in order: Dashboard (house.fill), Live (waveform), Detections (list.bullet), Search (magnifyingglass), Settings (gear)
**Why human:** Visual layout verification requires running the app

### 3. Empty State Pulsing Animation

**Test:** Open the Live tab before any detections arrive
**Expected:** A waveform SF Symbol animates with a repeating variable-color pulsing effect; "Listening for detections..." text below it
**Why human:** symbolEffect(.variableColor.iterative, options: .repeating) animation requires live UIKit rendering to observe

### 4. New Detections Pill Scroll Behavior

**Test:** Let several detections accumulate in the live feed, scroll down so the first item is not visible, then wait for a new detection to arrive
**Expected:** (a) The scroll position does NOT jump to top automatically; (b) A blue "N new detections" pill appears overlaid at the top of the feed; (c) Tapping the pill scrolls smoothly to the top and the pill disappears
**Why human:** Scroll position preservation and programmatic ScrollViewReader interaction require live UI testing

### 5. Background/Foreground SSE Lifecycle

**Test:** With the app connected and receiving events, press Home to background the app. Wait 35 seconds. Return to the app.
**Expected:** (a) After 30s in background the SSE connection drops; (b) On foreground return, connection indicator briefly shows orange/connecting then turns green; (c) Any events that arrived during background time backfill into the feed
**Why human:** ScenePhase transitions, 30-second timer, and backfill correctness require live testing with background/foreground transitions

### 6. Role-Based Event Filtering (End-to-End)

**Test:** Log in as a STATION user scoped to a specific station. Trigger detections from that station and from a different station.
**Expected:** Only detections from the scoped station appear in the Live feed; events from other stations are silently filtered on the server
**Why human:** Requires multiple user accounts with different roles/scopes and controllable detection input

---

## Overall Assessment

All 18 must-have truths are verified against the actual codebase. All 12 required artifacts exist and are substantive (well above minimum line counts). All 9 key links are confirmed wired -- no orphaned components. Both requirements LIVE-01 and LIVE-02 are satisfied. The test suite passes: 8 filter unit tests, 32 detection worker tests (including 4 new publish tests), and 6 SSE route integration tests all green.

The phase goal "Real-time Live Feed -- SSE endpoint streaming new detections to the iOS app with connection lifecycle management" is structurally achieved. The remaining 6 human verification items cover live runtime behavior (animations, scroll UX, end-to-end event flow, lifecycle transitions) that cannot be verified from static code analysis alone.

---

_Verified: 2026-03-16T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
