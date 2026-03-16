---
phase: 7
slug: live-feed
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.0.x |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `cd apps/api && pnpm test` |
| **Full suite command** | `cd apps/api && pnpm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && pnpm test`
- **After every plan wave:** Run `cd apps/api && pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | LIVE-01 | integration | `cd apps/api && pnpm vitest run tests/routes/live-feed.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | LIVE-01 | unit | `cd apps/api && pnpm vitest run tests/workers/detection.test.ts -x` | ✅ (extend) | ⬜ pending |
| 07-01-03 | 01 | 1 | LIVE-01 | integration | `cd apps/api && pnpm vitest run tests/routes/live-feed.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-01-04 | 01 | 1 | LIVE-02 | integration | `cd apps/api && pnpm vitest run tests/routes/live-feed.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-01-05 | 01 | 1 | LIVE-02 | unit | `cd apps/api && pnpm vitest run tests/lib/live-feed-filter.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/routes/live-feed.test.ts` — SSE route, auth, filtering, backfill (LIVE-01, LIVE-02)
- [ ] `tests/lib/live-feed-filter.test.ts` — unit tests for shouldDeliverToUser function (LIVE-02)
- [ ] Extend `tests/workers/detection.test.ts` — verify Redis PUBLISH call after AirplayEvent creation (LIVE-01)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS SSE client connects and receives live events | LIVE-01 | No XCTest infrastructure in project | Run in Simulator: open Live tab, trigger detection via API, verify event appears within seconds |
| New detections slide in from top with animation | LIVE-01 | UI animation behavior | Run in Simulator: observe detection appearance animation |
| "New detections" pill appears when scrolled away | LIVE-01 | Scroll interaction behavior | Run in Simulator: scroll down, trigger detection, verify pill appears |
| Connection status indicator (green/gray dot) | LIVE-01 | UI visual element | Run in Simulator: verify dot color changes on connect/disconnect |
| Role-based filtering in iOS (Artist sees own, Label sees its artists') | LIVE-02 | Requires multi-user iOS testing | Run in Simulator with different user roles, verify correct filtering |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
