---
phase: 2
slug: stream-recording-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter api test` |
| **Full suite command** | `pnpm test` (via Turbo) |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter api test`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | INFR-01 | integration | `pnpm --filter api vitest run tests/supervisor/stream-manager.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | INFR-01 | unit | `pnpm --filter api vitest run tests/supervisor/startup.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | INFR-02 | integration | `pnpm --filter api vitest run tests/routes/stations.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | INFR-02 | integration | `pnpm --filter api vitest run tests/routes/stations.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | INFR-02 | integration | `pnpm --filter api vitest run tests/routes/stations.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-02-04 | 02 | 1 | INFR-02 | integration | `pnpm --filter api vitest run tests/routes/stations.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | INFR-05 | unit | `pnpm --filter api vitest run tests/supervisor/watchdog.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | INFR-05 | unit | `pnpm --filter api vitest run tests/supervisor/backoff.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 2 | INFR-05 | unit | `pnpm --filter api vitest run tests/supervisor/backoff.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-03-04 | 03 | 2 | INFR-05 | integration | `pnpm --filter api vitest run tests/routes/stations.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-03-05 | 03 | 2 | INFR-05 | unit | `pnpm --filter api vitest run tests/workers/cleanup.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/tests/routes/stations.test.ts` — stubs for INFR-02 station CRUD routes
- [ ] `apps/api/tests/supervisor/stream-manager.test.ts` — stubs for INFR-01 FFmpeg spawn/stop
- [ ] `apps/api/tests/supervisor/watchdog.test.ts` — stubs for INFR-05 hang detection
- [ ] `apps/api/tests/supervisor/backoff.test.ts` — stubs for INFR-05 exponential backoff and circuit breaker
- [ ] `apps/api/tests/supervisor/startup.test.ts` — stubs for INFR-01 staggered startup
- [ ] `apps/api/tests/workers/cleanup.test.ts` — stubs for INFR-05 segment cleanup
- [ ] `apps/api/tests/lib/pubsub.test.ts` — stubs for Redis pub/sub helper functions
- [ ] Mock strategy: mock FFmpeg script that writes fake segment files (no real streams in CI)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| System sustains 200+ concurrent FFmpeg processes | INFR-01 | Requires production-scale hardware and real streams | Deploy to staging with 200+ stream URLs, monitor CPU/memory for 1 hour |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
