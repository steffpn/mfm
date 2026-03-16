---
phase: 09-notifications-station-intelligence
plan: 02
subsystem: api
tags: [prisma, fastify, typebox, competitors, station-intelligence, raw-sql, postgres]

# Dependency graph
requires:
  - phase: 05-authentication-user-management
    provides: "authenticate middleware, requireRole, STATION role, user scopes"
  - phase: 06-core-ios-dashboard
    provides: "dashboard aggregate query patterns, Prisma.$queryRaw usage, periodToDays helper"
provides:
  - "WatchedStation Prisma model for competitor station tracking"
  - "Competitor CRUD API: GET/POST/DELETE /competitors/watched"
  - "Competitor summary endpoint with play count + top song cards"
  - "Competitor detail endpoint with topSongs, recentDetections, comparison"
  - "21 integration tests for all competitor endpoints"
affects: [09-04-ios-competitor-views]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Plugin-level preHandler hooks for role restriction", "DISTINCT ON for top-N-per-group SQL pattern", "Cross-station comparison via conditional SUM CASE aggregation"]

key-files:
  created:
    - apps/api/prisma/migrations/20260316_add_watched_stations/migration.sql
    - apps/api/src/routes/v1/competitors/schema.ts
    - apps/api/src/routes/v1/competitors/handlers.ts
    - apps/api/src/routes/v1/competitors/index.ts
    - apps/api/tests/routes/competitors.test.ts
  modified:
    - apps/api/prisma/schema.prisma
    - apps/api/src/routes/v1/index.ts

key-decisions:
  - "Plugin-level addHook for authenticate+requireRole('STATION') instead of per-route preHandler arrays"
  - "DISTINCT ON with subquery for top song per station instead of window functions"
  - "Conditional SUM CASE for cross-station song comparison in a single query"
  - "Prisma P2002 error code catch for duplicate watched station detection"

patterns-established:
  - "Competitor CRUD follows same Fastify plugin pattern as dashboard/exports routes"
  - "WatchedStation model with unique userId+stationId enforces business constraint at DB level"

requirements-completed: [STIN-01, STIN-02]

# Metrics
duration: 14min
completed: 2026-03-16
---

# Phase 9 Plan 02: Competitor Station Intelligence Summary

**WatchedStation schema with CRUD API and SQL aggregation endpoints for competitor station play count, top song, and cross-station comparison intelligence**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-16T21:08:29Z
- **Completed:** 2026-03-16T21:23:06Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 7

## Accomplishments
- WatchedStation Prisma model with unique userId+stationId constraint and cascade delete
- Competitor CRUD API: list, add (max 20, prevent self-watch, 409 duplicates), and remove watched stations
- Summary endpoint aggregating play counts and top songs across all watched competitors
- Detail endpoint with top songs, recent detections, and cross-station comparison for overlapping songs
- All endpoints restricted to STATION role via plugin-level hooks
- 21 passing integration tests covering all endpoints, auth, role enforcement, and edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for competitor intelligence** - `9d9fa3c` (test)
2. **Task 1 (GREEN): Implement competitor API** - `bc4d62d` (feat)

_TDD task: test-first then implementation_

## Files Created/Modified
- `apps/api/prisma/schema.prisma` - Added WatchedStation model with relations to User and Station
- `apps/api/prisma/migrations/20260316_add_watched_stations/migration.sql` - CREATE TABLE with unique + user index
- `apps/api/src/routes/v1/competitors/schema.ts` - TypeBox schemas for request/response validation
- `apps/api/src/routes/v1/competitors/handlers.ts` - Five handlers: getWatchedStations, addWatchedStation, removeWatchedStation, getCompetitorSummary, getCompetitorDetail
- `apps/api/src/routes/v1/competitors/index.ts` - Fastify plugin with plugin-level auth hooks
- `apps/api/src/routes/v1/index.ts` - Registered competitors plugin with /competitors prefix
- `apps/api/tests/routes/competitors.test.ts` - 21 integration tests with Prisma mocks

## Decisions Made
- Plugin-level addHook for authenticate+requireRole('STATION') -- consistent with Phase 5 admin routes pattern, cleaner than per-route preHandler arrays
- DISTINCT ON with subquery for top song per station -- PostgreSQL-specific but efficient single-pass query
- Conditional SUM CASE for cross-station comparison -- finds overlapping songs between competitor and own stations in one query with HAVING clause
- Prisma P2002 error code catch for duplicate detection -- avoids race condition between count check and create

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Competitor API complete, ready for iOS competitor views (plan 04)
- All five endpoint handlers exported and tested
- WatchedStation model available for any future features needing competitor tracking

## Self-Check: PASSED

- All 7 files verified present on disk
- Commit `9d9fa3c` (test) verified in git log
- Commit `bc4d62d` (feat) verified in git log
- 21/21 competitor tests passing

---
*Phase: 09-notifications-station-intelligence*
*Completed: 2026-03-16*
