---
phase: 6
slug: core-ios-app-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x (backend API tests) |
| **Config file** | apps/api/vitest.config.ts |
| **Quick run command** | `cd apps/api && pnpm test -- --run tests/routes/dashboard.test.ts tests/routes/airplay-events-list.test.ts` |
| **Full suite command** | `cd apps/api && pnpm test` |
| **Estimated runtime** | ~15 seconds |

**iOS Testing Note:** iOS app uses SwiftUI with no existing test infrastructure. Validation focuses on backend API endpoint tests. iOS view testing is manual (Xcode previews + simulator).

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && pnpm test -- --run tests/routes/dashboard.test.ts tests/routes/airplay-events-list.test.ts`
- **After every plan wave:** Run `cd apps/api && pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green + iOS app builds without errors
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | DASH-01 | integration | `cd apps/api && pnpm test -- --run tests/routes/dashboard.test.ts` | No -- Wave 0 | ⬜ pending |
| 06-01-02 | 01 | 1 | DASH-02 | integration | `cd apps/api && pnpm test -- --run tests/routes/dashboard.test.ts` | No -- Wave 0 | ⬜ pending |
| 06-01-03 | 01 | 1 | DASH-03 | integration | `cd apps/api && pnpm test -- --run tests/routes/dashboard.test.ts` | No -- Wave 0 | ⬜ pending |
| 06-01-04 | 01 | 1 | DASH-04 | integration | `cd apps/api && pnpm test -- --run tests/routes/airplay-events-list.test.ts` | No -- Wave 0 | ⬜ pending |
| 06-01-05 | 01 | 1 | DASH-05 | integration | `cd apps/api && pnpm test -- --run tests/routes/airplay-events-list.test.ts` | No -- Wave 0 | ⬜ pending |
| 06-01-06 | 01 | 1 | DETC-04 | integration | `cd apps/api && pnpm test -- --run tests/routes/airplay-events-list.test.ts` | No -- Wave 0 | ⬜ pending |
| 06-02-01 | 02 | 1 | PLAY-01 | integration | `cd apps/api && pnpm test -- --run tests/routes/airplay-events.test.ts` | Yes | ⬜ pending |
| 06-02-02 | 02 | 1 | PLAY-02 | manual-only | Xcode Simulator manual test | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/tests/routes/dashboard.test.ts` — stubs for DASH-01, DASH-02, DASH-03
- [ ] `apps/api/tests/routes/airplay-events-list.test.ts` — stubs for DASH-04, DASH-05, DETC-04

*Existing infrastructure covers PLAY-01 (snippet endpoint test exists).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Inline snippet playback in iOS app | PLAY-02 | SwiftUI UI behavior, no XCTest infrastructure | 1. Open app in Simulator 2. Navigate to Detections tab 3. Tap play on a detection row 4. Verify audio plays inline with progress bar 5. Tap play on another detection 6. Verify previous stops, new one plays |
| Dashboard charts render correctly | DASH-01, DASH-02 | Visual rendering in Swift Charts | 1. Open Dashboard tab 2. Verify summary cards show counts 3. Switch Day/Week/Month segments 4. Verify charts update with correct data |
| Search and filter UX | DASH-04, DASH-05 | iOS search/filter interaction behavior | 1. Navigate to Search tab 2. Type song title, verify results filter 3. Apply date range filter 4. Apply station filter 5. Verify combined filters work |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
