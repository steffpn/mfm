---
phase: 08-export-reporting
plan: 01
subsystem: api
tags: [csv-stringify, pdfkit, export, csv, pdf, fastify, typebox]

# Dependency graph
requires:
  - phase: 05-auth
    provides: "authenticate middleware, CurrentUser type, role-based scopes"
  - phase: 06-core-ios-app
    provides: "airplay-events list handler with query/scope filtering logic"
provides:
  - "GET /api/v1/exports/csv endpoint with filtered CSV download"
  - "GET /api/v1/exports/pdf endpoint with branded PDF report generation"
  - "Shared queryFilteredEvents builder for export and future use"
  - "CSV injection prevention via cell value sanitization"
affects: [08-02-ios-export-ui]

# Tech tracking
tech-stack:
  added: [csv-stringify, pdfkit]
  patterns: [lazy-import-for-heavy-modules, shared-query-builder, csv-injection-prevention]

key-files:
  created:
    - apps/api/src/routes/v1/exports/index.ts
    - apps/api/src/routes/v1/exports/schema.ts
    - apps/api/src/routes/v1/exports/handlers.ts
    - apps/api/src/routes/v1/exports/query.ts
    - apps/api/src/routes/v1/exports/csv-builder.ts
    - apps/api/src/routes/v1/exports/pdf-builder.ts
    - apps/api/tests/routes/exports.test.ts
  modified:
    - apps/api/src/routes/v1/index.ts
    - apps/api/package.json
    - apps/api/vitest.config.ts

key-decisions:
  - "Replaced pdfmake with pdfkit direct usage -- pdfmake ESM import hangs indefinitely in vitest/vite transform pipeline"
  - "Lazy import for pdf-builder.js in exportPDF handler -- pdfkit module takes ~90s to load in dev, would block server startup"
  - "Increased vitest hookTimeout to 30s -- server startup with pdfkit in dependency graph needs more time"

patterns-established:
  - "Lazy import pattern: heavy modules loaded at request time via dynamic import() to avoid blocking server startup"
  - "Shared query builder: queryFilteredEvents extracts common filter/scope logic for reuse across endpoints"
  - "CSV injection prevention: cell values starting with =, +, -, @, \\t, \\r prefixed with single quote"

requirements-completed: [EXPT-01, EXPT-02]

# Metrics
duration: 17min
completed: 2026-03-16
---

# Phase 8 Plan 1: Export Endpoints Summary

**CSV and PDF export endpoints using csv-stringify and pdfkit with shared query builder, scope filtering, formula injection prevention, and row caps**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-16T13:03:11Z
- **Completed:** 2026-03-16T14:52:36Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- GET /api/v1/exports/csv returns filtered CSV with correct headers, scope-based data access, and formula injection prevention
- GET /api/v1/exports/pdf returns branded PDF report with header, summary stats, data table, and page footers
- Shared queryFilteredEvents builder extracted from airplay-events handler for reuse
- CSV capped at 10,000 rows, PDF at 1,000 rows, with helpful error messages when exceeded
- Both endpoints enforce authentication and role-based scope filtering (STATION sees only scoped stations)

## Task Commits

Each task was committed atomically:

1. **Task 1: CSV export endpoint** - `5231ec8` (test: RED) + `5439c97` (feat: GREEN)
2. **Task 2: PDF export endpoint** - `2074392` (test: RED) + `0e4d8ad` (feat: GREEN)

_TDD tasks have RED (test) and GREEN (implementation) commits._

## Files Created/Modified
- `apps/api/src/routes/v1/exports/index.ts` - Fastify plugin registering /csv and /pdf routes with auth
- `apps/api/src/routes/v1/exports/schema.ts` - TypeBox schemas for CSV (optional dates) and PDF (required dates) query params
- `apps/api/src/routes/v1/exports/handlers.ts` - exportCSV and exportPDF handler functions
- `apps/api/src/routes/v1/exports/query.ts` - Shared queryFilteredEvents with scope filtering and row cap detection
- `apps/api/src/routes/v1/exports/csv-builder.ts` - CSV stream builder with formula injection sanitization
- `apps/api/src/routes/v1/exports/pdf-builder.ts` - PDFKit-based branded report with header, summary, table, footer
- `apps/api/tests/routes/exports.test.ts` - 20 route-level tests (10 CSV + 10 PDF)
- `apps/api/src/routes/v1/index.ts` - Added exports plugin registration
- `apps/api/package.json` - Added csv-stringify, pdfkit, @types/pdfkit
- `apps/api/vitest.config.ts` - Added hookTimeout for pdfkit loading

## Decisions Made
- **pdfkit instead of pdfmake:** pdfmake's ESM import hangs indefinitely in vitest/vite's module transform pipeline. pdfkit (which pdfmake wraps) works directly and produces correct PDFs. This is a deviation from the research recommendation but achieves the same result.
- **Lazy import pattern for pdfkit:** pdfkit takes ~90s to load in development (vite transform of many internal modules). Using dynamic import() in the handler ensures server startup is fast, with the import cost paid only on first PDF request.
- **hookTimeout increase:** Set to 30s (matching testTimeout) because server.ready() with the full plugin graph can exceed the default 10s hookTimeout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced pdfmake with pdfkit due to import hang**
- **Found during:** Task 2 (PDF export implementation)
- **Issue:** pdfmake's CJS/ESM import hangs indefinitely in both Node.js require() and vitest's vite transform pipeline, preventing server startup and test execution
- **Fix:** Installed pdfkit directly (pdfmake's underlying library), wrote pdf-builder.ts using PDFKit's imperative API with Helvetica built-in fonts
- **Files modified:** apps/api/package.json, apps/api/src/routes/v1/exports/pdf-builder.ts
- **Verification:** PDF generation produces valid %PDF output, all 10 PDF tests pass
- **Committed in:** 0e4d8ad

**2. [Rule 3 - Blocking] Added lazy import for pdf-builder module**
- **Found during:** Task 2 (PDF export implementation)
- **Issue:** Even with pdfkit, the module takes ~90s to load in dev (vite transforms ~200 internal files). Static import in handlers.ts blocks server.ready() causing all tests to timeout
- **Fix:** Changed to dynamic import("./pdf-builder.js") inside exportPDF handler, loaded only on first request
- **Files modified:** apps/api/src/routes/v1/exports/handlers.ts
- **Verification:** Server starts in <1s, first PDF request incurs load time, subsequent requests are fast
- **Committed in:** 0e4d8ad

**3. [Rule 3 - Blocking] Increased vitest hookTimeout for server startup**
- **Found during:** Task 2 (PDF export implementation)
- **Issue:** Default hookTimeout of 10s insufficient for beforeEach server.ready() when pdfkit is in the module graph
- **Fix:** Set hookTimeout: 30000 in vitest.config.ts to match testTimeout
- **Files modified:** apps/api/vitest.config.ts
- **Verification:** All tests pass without hook timeouts
- **Committed in:** 0e4d8ad

---

**Total deviations:** 3 auto-fixed (all Rule 3 - blocking issues)
**Impact on plan:** All auto-fixes necessary for correct operation with pdfkit. No scope creep. The pdfmake-to-pdfkit switch produces identical functionality.

## Issues Encountered
- pdfmake library hangs on import in Node.js/vitest - resolved by switching to pdfkit direct
- pdfkit slow module loading (~90s in dev) - resolved with lazy import pattern
- vitest hookTimeout too short for server with pdfkit - resolved by increasing to 30s
- pnpm add commands destabilized node_modules requiring `pnpm install` to sync properly

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend export endpoints ready for iOS client integration (Plan 08-02)
- CSV endpoint: GET /api/v1/exports/csv with optional q, startDate, endDate, stationId params
- PDF endpoint: GET /api/v1/exports/pdf with required startDate/endDate, optional q, stationId params
- Both return file content with proper Content-Type and Content-Disposition headers

---
*Phase: 08-export-reporting*
*Completed: 2026-03-16*
