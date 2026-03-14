---
phase: 01-project-foundation
plan: 01
subsystem: infra
tags: [turborepo, pnpm, docker-compose, timescaledb, redis, typescript, fastify, monorepo]

# Dependency graph
requires:
  - phase: none
    provides: greenfield project
provides:
  - pnpm monorepo with Turborepo build orchestration
  - Docker Compose with TimescaleDB (pg17) and Redis 7
  - Shared TypeScript types package (@myfuckingmusic/shared)
  - Full v1 type definitions (detection, station, user, snippet, invitation)
  - Shared tsconfig base and API configurations
  - Fastify server entry point scaffold
affects: [01-02, 01-03, 02, 03, 04, 05, 06]

# Tech tracking
tech-stack:
  added: [turborepo@2.8.17, pnpm@10.6.0, typescript@5.x, fastify@5.8, prisma@7.3, bullmq@5.71, ioredis@5.4, pg@8.13, timescaledb-pg17, redis-7-alpine, vitest@3.0, tsx@4.19]
  patterns: [pnpm-workspace, turborepo-tasks, esm-modules, barrel-exports, shared-tsconfig-extends]

key-files:
  created:
    - package.json
    - turbo.json
    - pnpm-workspace.yaml
    - docker-compose.yml
    - .env.example
    - .gitignore
    - .npmrc
    - .nvmrc
    - apps/api/package.json
    - apps/api/tsconfig.json
    - apps/api/src/index.ts
    - packages/shared/package.json
    - packages/shared/tsconfig.json
    - packages/shared/src/index.ts
    - packages/shared/src/types/detection.ts
    - packages/shared/src/types/station.ts
    - packages/shared/src/types/user.ts
    - packages/shared/src/types/snippet.ts
    - packages/shared/src/types/invitation.ts
    - packages/shared/src/enums/roles.ts
    - packages/shared/src/enums/status.ts
    - packages/shared/src/constants/index.ts
    - packages/tsconfig/package.json
    - packages/tsconfig/base.json
    - packages/tsconfig/api.json
  modified: []

key-decisions:
  - "rootDir/outDir in consuming tsconfig, not shared base -- avoids path resolution issues when extending across workspace packages"
  - "Node 20.19.5 via .nvmrc -- Prisma 7 requires 20.19+, project had 20.10.0"
  - "pnpm.onlyBuiltDependencies in root package.json -- pnpm 10.x blocks build scripts by default"
  - "Shared package placeholder created in Task 1 to unblock workspace dependency resolution"

patterns-established:
  - "ESM-only: all packages use type=module and .js extensions in imports"
  - "Shared tsconfig: base.json for common options, api.json for lib; rootDir/outDir set per-package"
  - "Barrel exports: index.ts re-exports all types/enums/constants from subfolders"
  - "Workspace deps: use workspace:* protocol for internal package references"

requirements-completed: [DETC-05]

# Metrics
duration: 7min
completed: 2026-03-14
---

# Phase 1 Plan 1: Monorepo Scaffolding Summary

**pnpm + Turborepo monorepo with Docker Compose (TimescaleDB + Redis), shared TypeScript types for all v1 data models, and Fastify server scaffold**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-14T01:12:19Z
- **Completed:** 2026-03-14T01:19:32Z
- **Tasks:** 2
- **Files modified:** 25

## Accomplishments
- Full monorepo structure with pnpm 10.6.0 workspaces and Turborepo 2.8 task orchestration
- Docker Compose with TimescaleDB (pg17) and Redis 7 for local development
- Complete v1 shared types: DetectionEvent, AirplayEvent, Station, User, AudioSnippet, Invitation with all create/update interfaces
- Enums (UserRole, InvitationStatus, StreamStatus, DetectionStatus) and domain constants
- Fastify server entry point with health check endpoint

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold monorepo structure with Docker Compose** - `1c17417` (feat)
2. **Task 2: Create shared types package with full v1 type definitions** - `422ccd5` (feat)

## Files Created/Modified
- `package.json` - Root monorepo config with turbo scripts and pnpm 10.6.0
- `turbo.json` - Turborepo task configuration (build, dev, test, lint, generate)
- `pnpm-workspace.yaml` - Workspace declaration (apps/*, packages/*)
- `docker-compose.yml` - TimescaleDB pg17 + Redis 7-alpine with healthchecks
- `.env.example` - DATABASE_URL and REDIS_URL templates
- `.gitignore` - node_modules, dist, generated, .env, .turbo, Xcode userdata
- `.npmrc` - auto-install-peers=true
- `.nvmrc` - Node 20.19.5 (Prisma 7 requirement)
- `apps/api/package.json` - API package with Fastify, Prisma 7, BullMQ dependencies
- `apps/api/tsconfig.json` - Extends @myfuckingmusic/tsconfig/api.json
- `apps/api/src/index.ts` - Fastify server with /health endpoint
- `packages/shared/package.json` - Shared types package config
- `packages/shared/tsconfig.json` - Extends base.json with rootDir/outDir
- `packages/shared/src/index.ts` - Barrel re-export of all types/enums/constants
- `packages/shared/src/types/detection.ts` - DetectionEvent, DetectionCreate, AirplayEvent, AirplayCreate
- `packages/shared/src/types/station.ts` - Station, StationCreate, StationUpdate
- `packages/shared/src/types/user.ts` - User, UserCreate, UserPublic
- `packages/shared/src/types/snippet.ts` - AudioSnippet, SnippetCreate
- `packages/shared/src/types/invitation.ts` - Invitation, InvitationCreate
- `packages/shared/src/enums/roles.ts` - UserRole, InvitationStatus enums
- `packages/shared/src/enums/status.ts` - StreamStatus, DetectionStatus enums
- `packages/shared/src/constants/index.ts` - Domain constants (snippet, JWT, API)
- `packages/tsconfig/package.json` - Shared tsconfig package
- `packages/tsconfig/base.json` - TypeScript base config (ES2022, ESNext, bundler, strict)
- `packages/tsconfig/api.json` - API-specific config (ES2022 lib)

## Decisions Made
- **rootDir/outDir placement:** Moved from shared tsconfig to consuming packages to avoid path resolution issues when extending across workspaces
- **Node 20.19.5:** Prisma 7.3 requires Node 20.19+; added .nvmrc for consistency
- **pnpm 10 build scripts:** Added `pnpm.onlyBuiltDependencies` to root package.json to whitelist Prisma/esbuild build scripts (pnpm 10 blocks by default)
- **Early shared package creation:** Created placeholder in Task 1 to resolve workspace dependency cycle (api depends on shared)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created shared package placeholder in Task 1**
- **Found during:** Task 1 (pnpm install verification)
- **Issue:** pnpm install failed because `@myfuckingmusic/shared` workspace dependency didn't exist yet
- **Fix:** Created minimal packages/shared with package.json, tsconfig.json, and empty index.ts
- **Files modified:** packages/shared/package.json, packages/shared/tsconfig.json, packages/shared/src/index.ts
- **Verification:** pnpm install completes without errors
- **Committed in:** 1c17417 (Task 1 commit)

**2. [Rule 3 - Blocking] Upgraded Node.js to 20.19.5 for Prisma 7 compatibility**
- **Found during:** Task 1 (pnpm install with build scripts)
- **Issue:** Prisma 7 preinstall script requires Node 20.19+; system had Node 20.10.0
- **Fix:** Added .nvmrc targeting Node 20.19.5 (already installed via nvm); configured COREPACK_HOME for pnpm 10.6.0
- **Files modified:** .nvmrc
- **Verification:** pnpm install completes, Prisma installs without errors
- **Committed in:** 1c17417 (Task 1 commit)

**3. [Rule 3 - Blocking] Fixed tsconfig rootDir resolution across workspaces**
- **Found during:** Task 2 (turbo build verification)
- **Issue:** rootDir in packages/tsconfig/api.json resolved relative to tsconfig location, not consuming project
- **Fix:** Moved rootDir/outDir to apps/api/tsconfig.json; kept only lib setting in shared api.json
- **Files modified:** packages/tsconfig/api.json, apps/api/tsconfig.json
- **Verification:** turbo run build compiles all packages successfully
- **Committed in:** 422ccd5 (Task 2 commit)

**4. [Rule 3 - Blocking] Created Fastify server entry point**
- **Found during:** Task 2 (turbo build verification)
- **Issue:** api build failed with "No inputs found" because apps/api/src/ was empty
- **Fix:** Created apps/api/src/index.ts with Fastify server scaffold and /health endpoint
- **Files modified:** apps/api/src/index.ts
- **Verification:** turbo run build succeeds for api package
- **Committed in:** 422ccd5 (Task 2 commit)

**5. [Rule 1 - Bug] Added @myfuckingmusic/tsconfig workspace dependency**
- **Found during:** Task 2 (turbo build verification)
- **Issue:** TypeScript couldn't resolve `@myfuckingmusic/tsconfig/base.json` extends in shared package
- **Fix:** Added `@myfuckingmusic/tsconfig: workspace:*` to devDependencies in shared and api packages
- **Files modified:** packages/shared/package.json, apps/api/package.json
- **Verification:** turbo run build compiles all packages
- **Committed in:** 422ccd5 (Task 2 commit)

---

**Total deviations:** 5 auto-fixed (1 bug fix, 4 blocking issues)
**Impact on plan:** All auto-fixes necessary for build correctness. No scope creep. The plan assumed sequential tasks but workspace dependency resolution required early shared package creation.

## Issues Encountered
- pnpm 10.x blocks build scripts by default (new security feature) -- resolved with `onlyBuiltDependencies` config
- corepack cache directory owned by root -- worked around by setting COREPACK_HOME to user-writable location

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Monorepo structure ready for Plan 01-02 (Prisma schema, TimescaleDB migrations, Fastify server)
- Docker Compose ready for `docker compose up -d` to start TimescaleDB and Redis
- All shared types ready for import by API routes and iOS app data models
- Users must run `nvm use` or have Node 20.19+ to work with Prisma 7

## Self-Check: PASSED

All 25 created files verified present on disk. Both task commits (1c17417, 422ccd5) verified in git log.

---
*Phase: 01-project-foundation*
*Completed: 2026-03-14*
