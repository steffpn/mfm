# Phase 2 - Deferred Items

## Pre-existing Issues (Out of Scope)

1. **TSC build error: prisma.config.ts outside rootDir**
   - `apps/api/tsconfig.json` includes `prisma.config.ts` in its `include` array, but `rootDir` is set to `./src`
   - This causes `tsc` to fail with TS6059
   - Pre-existing before Plan 02-01, not caused by any Phase 2 changes
   - Fix: Either move `prisma.config.ts` into `src/` or add a separate `tsconfig.build.json` that excludes it

2. **Untracked supervisor files from prior execution**
   - `apps/api/src/services/supervisor/` and `apps/api/tests/supervisor/` contain untracked files from a prior (likely aborted) plan execution
   - `backoff.test.ts` fails because it references prisma operations not mocked properly
   - These are NOT part of Plan 02-01's scope
