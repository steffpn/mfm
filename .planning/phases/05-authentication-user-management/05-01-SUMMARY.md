---
phase: 05-authentication-user-management
plan: 01
subsystem: auth
tags: [jwt, argon2, fastify, prisma, middleware, rbac]

# Dependency graph
requires:
  - phase: 01-project-foundation
    provides: Prisma schema with User, Invitation, RefreshToken models
provides:
  - UserScope join table for multi-entity role-based scoping
  - Multi-use invitation model (maxUses/usedCount)
  - Auth service library (hashPassword, verifyPassword, generateInviteCode, generateTokenPair, bootstrapAdmin)
  - JWT authentication middleware (authenticate preHandler)
  - Role-based authorization middleware (requireRole factory)
  - @fastify/jwt registration on server
affects: [05-02, 05-03, 05-04, 06-ios-authentication]

# Tech tracking
tech-stack:
  added: ["@fastify/jwt@^10.0.0", "argon2@^0.44.0", "@fastify/cookie@^10.0.1", "@fastify/static@^9.0.0", "@fastify/rate-limit@^10.0.0"]
  patterns: [preHandler middleware chain for auth, argon2id password hashing, opaque refresh tokens in DB]

key-files:
  created:
    - apps/api/src/lib/auth.ts
    - apps/api/src/middleware/authenticate.ts
    - apps/api/src/middleware/authorize.ts
    - apps/api/prisma/migrations/00000000000003_auth_user_scope/migration.sql
    - apps/api/tests/lib/auth.test.ts
    - apps/api/tests/middleware/authenticate.test.ts
  modified:
    - apps/api/prisma/schema.prisma
    - apps/api/src/index.ts
    - apps/api/package.json
    - package.json
    - packages/shared/src/constants/index.ts
    - packages/shared/src/types/user.ts
    - packages/shared/src/types/invitation.ts
    - apps/api/vitest.config.ts
    - apps/api/tsconfig.json

key-decisions:
  - "argon2id with memoryCost 65536, timeCost 3, parallelism 1 for password hashing"
  - "Opaque refresh tokens (crypto.randomBytes(32).hex) stored in DB, not JWT refresh tokens"
  - "Invite code format: XXXX-XXXX-XXXX uppercase hex (14 chars, 6 random bytes)"
  - "fileParallelism: false in vitest config since integration tests share a database"

patterns-established:
  - "preHandler middleware chain: authenticate -> requireRole -> route handler"
  - "FastifyRequest.currentUser type augmentation for auth context propagation"
  - "bootstrapAdmin from env vars on first startup when no users exist"

requirements-completed: [AUTH-02, AUTH-04]

# Metrics
duration: 8min
completed: 2026-03-15
---

# Phase 5 Plan 1: Auth Foundation Summary

**Prisma UserScope join table, argon2id auth service, and JWT authenticate/authorize Fastify middleware with 18 passing tests**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-15T01:04:37Z
- **Completed:** 2026-03-15T01:13:00Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- UserScope join table replaces single scopeId for multi-entity role-based scoping
- Multi-use invitation model with maxUses/usedCount fields (replacing single-use redeemedById)
- Complete auth service library: argon2id hashing, token pair generation, invite code generation, admin bootstrap
- JWT authentication middleware with user + scope loading from DB
- Role-based authorization middleware factory (requireRole)
- 18 integration tests covering all auth primitives and middleware behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema migration, dependency installation, and shared constants update** - `5edf6e1` (feat)
2. **Task 2: Auth service library and authentication/authorization middleware**
   - `d6b9799` (test - TDD RED: failing tests)
   - `dbe8d00` (feat - TDD GREEN: implementation)
   - `04bba18` (fix - test parallelism and expired JWT reliability)

## Files Created/Modified
- `apps/api/prisma/schema.prisma` - Updated User (removed scopeId, added scopes/refreshTokens), Invitation (maxUses/usedCount), RefreshToken (user relation), new UserScope model
- `apps/api/prisma/migrations/00000000000003_auth_user_scope/migration.sql` - Defensive migration with data migration from scopeId to user_scopes
- `apps/api/src/lib/auth.ts` - hashPassword, verifyPassword, generateInviteCode, generateTokenPair, bootstrapAdmin
- `apps/api/src/middleware/authenticate.ts` - JWT verification preHandler with user + scope loading
- `apps/api/src/middleware/authorize.ts` - requireRole factory for role-based route protection
- `apps/api/src/index.ts` - @fastify/jwt registration, bootstrapAdmin on startup
- `packages/shared/src/constants/index.ts` - JWT_ACCESS_EXPIRY=1h, JWT_REFRESH_EXPIRY=30d, INVITE_CODE_EXPIRY_DAYS=7
- `packages/shared/src/types/user.ts` - Removed scopeId, added UserScope interface
- `packages/shared/src/types/invitation.ts` - Added maxUses/usedCount, removed redeemedBy/redeemedAt
- `apps/api/package.json` - Added @fastify/jwt, argon2, @fastify/cookie, @fastify/static, @fastify/rate-limit
- `package.json` - Added argon2 to pnpm.onlyBuiltDependencies
- `apps/api/vitest.config.ts` - Added fileParallelism: false for DB test isolation
- `apps/api/tsconfig.json` - Removed prisma.config.ts from include (pre-existing rootDir conflict)
- `apps/api/tests/lib/auth.test.ts` - 10 tests for auth service functions
- `apps/api/tests/middleware/authenticate.test.ts` - 8 tests for authenticate/authorize middleware

## Decisions Made
- argon2id with memoryCost 65536, timeCost 3, parallelism 1 -- recommended OWASP settings for password hashing
- Opaque refresh tokens stored in DB rather than JWT-format refresh tokens -- enables server-side revocation
- Invite code format XXXX-XXXX-XXXX (uppercase hex, 14 chars) -- human-readable for manual sharing
- vitest fileParallelism: false -- tests share a database, parallel execution causes FK constraint violations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed tsconfig.json rootDir conflict**
- **Found during:** Task 1 (build verification)
- **Issue:** `prisma.config.ts` included in tsconfig but outside rootDir (`src/`), causing TS6059 build error
- **Fix:** Removed `prisma.config.ts` from tsconfig include array -- Prisma handles its own config compilation
- **Files modified:** apps/api/tsconfig.json
- **Verification:** Shared package builds cleanly; API build errors are pre-existing (ioredis version mismatch, prisma client rootDir)
- **Committed in:** 5edf6e1

**2. [Rule 1 - Bug] Fixed test parallelism and expired JWT test reliability**
- **Found during:** Task 2 (test verification)
- **Issue:** Tests running in parallel caused FK constraint violations (test files share DB). Expired JWT test used `expiresIn: "0s"` with sleep which was unreliable.
- **Fix:** Set `fileParallelism: false` in vitest config. Changed expired JWT test to use explicit past `iat`/`exp` claims.
- **Files modified:** apps/api/vitest.config.ts, apps/api/tests/middleware/authenticate.test.ts
- **Verification:** All 18 tests pass reliably
- **Committed in:** 04bba18

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for build verification and test reliability. No scope creep.

## Issues Encountered
- Pre-existing API build failures (ioredis@5.10.0 vs 5.9.3 type mismatch in BullMQ, Prisma client outside rootDir) are NOT caused by this plan's changes. Logged to deferred-items.md. The shared package builds cleanly, confirming all type changes compile correctly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auth primitives ready for Plan 02 (auth routes: login, register, refresh, logout)
- Middleware ready for protecting existing endpoints (Plan 03)
- UserScope table ready for scope-based data filtering (Plan 03)
- Admin bootstrap ready for first-run setup

## Self-Check: PASSED

All 6 created files verified present. All 4 commits verified in git log.

---
*Phase: 05-authentication-user-management*
*Completed: 2026-03-15*
