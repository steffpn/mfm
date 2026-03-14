---
phase: 1
slug: project-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `apps/api/vitest.config.ts` (Wave 0 installs) |
| **Quick run command** | `pnpm --filter api test` |
| **Full suite command** | `turbo run test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter api test`
- **After every plan wave:** Run `turbo run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | FOUND-infra | setup | `pnpm --filter api test` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | DETC-05 | integration | `pnpm --filter api test -- tests/db/hypertable.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | FOUND-01 | integration | `pnpm --filter api test -- tests/db/migration.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | FOUND-02 | unit | `pnpm --filter shared test -- tests/types.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | FOUND-03 | smoke | `pnpm --filter api test -- tests/server.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/vitest.config.ts` — Vitest configuration for API package
- [ ] `apps/api/tests/db/hypertable.test.ts` — stubs for DETC-05 (hypertable verification)
- [ ] `apps/api/tests/db/migration.test.ts` — stubs for migration verification
- [ ] `apps/api/tests/server.test.ts` — stubs for Fastify server smoke test
- [ ] `packages/shared/vitest.config.ts` — Vitest configuration for shared package
- [ ] `packages/shared/tests/types.test.ts` — stubs for type export verification
- [ ] Framework install: `pnpm add -D vitest` in api and shared packages

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Docker Compose services start and are reachable | FOUND-04 (implicit) | Infrastructure test requiring Docker daemon | `docker compose up -d && docker compose ps` — verify both db and redis show "healthy" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
