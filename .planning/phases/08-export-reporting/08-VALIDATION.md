---
phase: 8
slug: export-reporting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | apps/api/vitest.config.ts |
| **Quick run command** | `cd apps/api && pnpm test -- --run tests/routes/exports.test.ts` |
| **Full suite command** | `cd apps/api && pnpm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && pnpm test -- --run tests/routes/exports.test.ts`
- **After every plan wave:** Run `cd apps/api && pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | EXPT-01 | unit | `cd apps/api && pnpm test -- --run tests/routes/exports.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | EXPT-01 | unit | `cd apps/api && pnpm test -- --run tests/routes/exports.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-03 | 01 | 1 | EXPT-01 | unit | `cd apps/api && pnpm test -- --run tests/routes/exports.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-04 | 01 | 1 | EXPT-01 | unit | `cd apps/api && pnpm test -- --run tests/routes/exports.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 1 | EXPT-02 | unit | `cd apps/api && pnpm test -- --run tests/routes/exports.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 1 | EXPT-02 | unit | `cd apps/api && pnpm test -- --run tests/routes/exports.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-03 | 02 | 1 | EXPT-02 | unit | `cd apps/api && pnpm test -- --run tests/routes/exports.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/tests/routes/exports.test.ts` — stubs for EXPT-01, EXPT-02 (route-level tests with mocked Prisma, following existing airplay-events-list.test.ts pattern)

*Existing infrastructure covers framework and config; only test file stubs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS ShareLink presents correct share sheet | EXPT-01, EXPT-02 | ShareLink UI interaction requires physical device/simulator | 1. Open DetectionsView 2. Tap export button 3. Select CSV or PDF 4. Verify share sheet appears with correct file type |
| PDF renders correctly with branding and tables | EXPT-02 | Visual verification of PDF layout | 1. Export PDF report 2. Open in PDF viewer 3. Verify header, table columns, pagination |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
