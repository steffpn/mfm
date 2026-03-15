---
phase: 04-audio-snippet-system
plan: 02
subsystem: api
tags: [bullmq, fastify, typebox, detection, supervisor, snippet, presigned-url, airplay-events]

# Dependency graph
requires:
  - phase: 04-audio-snippet-system/plan-01
    provides: "startSnippetWorker(), SNIPPET_QUEUE constant, getPresignedUrl() from R2 client"
  - phase: 03-detection-pipeline
    provides: "Detection worker processCallback, supervisor lifecycle, AirplayEvent model with snippetUrl field"
  - phase: 02-stream-recording-infrastructure
    provides: "Supervisor startup/shutdown orchestration pattern, BullMQ worker lifecycle"
provides:
  - "Detection worker enqueues snippet extraction jobs for new AirplayEvents when SNIPPETS_ENABLED=true"
  - "Supervisor manages snippet worker lifecycle with correct shutdown ordering"
  - "GET /api/v1/airplay-events/:id/snippet returns presigned R2 URL for snippet playback"
  - "SNIPPETS_ENABLED kill switch prevents snippet enqueue when disabled"
affects: [05-authentication, 06-ios-app]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Snippet queue dependency injection from supervisor to detection worker", "Fastify airplay-events route plugin with TypeBox param validation", "Best-effort snippet enqueue with try/catch (non-blocking)"]

key-files:
  created:
    - apps/api/src/routes/v1/airplay-events/index.ts
    - apps/api/src/routes/v1/airplay-events/schema.ts
    - apps/api/src/routes/v1/airplay-events/handlers.ts
    - apps/api/tests/routes/airplay-events.test.ts
  modified:
    - apps/api/src/workers/detection.ts
    - apps/api/src/services/supervisor/index.ts
    - apps/api/src/routes/v1/index.ts
    - apps/api/tests/workers/detection.test.ts

key-decisions:
  - "Snippet queue injected from supervisor to detection worker via optional parameter (no circular deps)"
  - "Snippet enqueue is best-effort with try/catch -- errors logged but do not fail detection processing"
  - "Snippet worker shutdown ordered after detection worker but before cleanup worker in supervisor sequence"
  - "Snippet URL endpoint unauthenticated for now -- auth middleware deferred to Phase 5"

patterns-established:
  - "Airplay events route plugin: routes/v1/airplay-events/index.ts + schema.ts + handlers.ts"
  - "Optional worker queue injection: startDetectionWorker({ snippetQueue }) for cross-worker communication"

requirements-completed: [INFR-03, INFR-04]

# Metrics
duration: 6min
completed: 2026-03-15
---

# Phase 4 Plan 2: Detection Integration, Supervisor Wiring, Snippet URL Endpoint Summary

**Detection worker enqueues snippet jobs for new airplay events, supervisor manages snippet worker lifecycle, and GET /airplay-events/:id/snippet serves presigned R2 URLs for audio proof playback**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-15T00:08:06Z
- **Completed:** 2026-03-15T00:14:00Z
- **Tasks:** 2 (1 TDD + 1 checkpoint verification)
- **Files modified:** 8

## Accomplishments
- Detection worker enqueues snippet extraction jobs only for NEW AirplayEvents when SNIPPETS_ENABLED=true (not when extending existing events)
- Supervisor starts snippet worker before detection worker and shuts down in correct order: detection -> snippet -> cleanup
- GET /api/v1/airplay-events/:id/snippet endpoint returns presigned R2 URL with 24h expiry or appropriate 404
- Full test coverage: 147/147 tests pass across entire API test suite with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for detection snippet enqueue and snippet URL endpoint** - `c749f93` (test)
2. **Task 1 (GREEN): Wire snippet pipeline into detection, supervisor, and API** - `ff78544` (feat)

_Task 2 was a verification-only checkpoint (no code changes) -- approved by user after confirming 147/147 tests pass._

## Files Created/Modified
- `apps/api/src/routes/v1/airplay-events/index.ts` - Fastify plugin registering GET /:id/snippet with TypeBox validation
- `apps/api/src/routes/v1/airplay-events/schema.ts` - TypeBox schemas for AirplayEventParams and SnippetUrlResponse
- `apps/api/src/routes/v1/airplay-events/handlers.ts` - Handler returning presigned URL from R2 or 404
- `apps/api/src/routes/v1/index.ts` - Registered airplay-events route plugin with /airplay-events prefix
- `apps/api/src/workers/detection.ts` - Added optional snippetQueue parameter and enqueue logic for new events
- `apps/api/src/services/supervisor/index.ts` - Snippet worker lifecycle management with correct shutdown ordering
- `apps/api/tests/routes/airplay-events.test.ts` - Tests for snippet URL endpoint (200, 404 not found, 404 no snippet)
- `apps/api/tests/workers/detection.test.ts` - Tests for snippet enqueue (new event, extend, kill switch)

## Decisions Made
- Snippet queue injected from supervisor to detection worker via optional parameter (avoids circular dependencies)
- Snippet enqueue is best-effort with try/catch -- errors logged but do not fail detection processing
- Snippet worker shutdown ordered after detection worker but before cleanup worker in supervisor sequence
- Snippet URL endpoint unauthenticated for now -- auth middleware deferred to Phase 5 (comment in code)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - all R2 credentials and SNIPPETS_ENABLED configuration were documented in Plan 01 setup. No additional configuration needed for this plan.

## Next Phase Readiness
- Phase 4 (Audio Snippet System) is fully complete -- end-to-end pipeline from detection to snippet playback URL
- Complete chain: detection event -> snippet queue -> FFmpeg extraction -> R2 upload -> DB update -> presigned URL API
- Phase 5 (Authentication & User Management) can proceed -- snippet endpoint has TODO comment for JWT auth middleware
- Phase 6 (iOS App) can integrate snippet playback via GET /api/v1/airplay-events/:id/snippet

## Self-Check: PASSED

All 8 created/modified files verified on disk. Both task commits (c749f93, ff78544) verified in git log.

---
*Phase: 04-audio-snippet-system*
*Completed: 2026-03-15*
