---
phase: 04-audio-snippet-system
plan: 01
subsystem: infra
tags: [ffmpeg, r2, aws-sdk, bullmq, aac, cloudflare, snippet, audio]

# Dependency graph
requires:
  - phase: 02-stream-recording-infrastructure
    provides: "Ring buffer segment files (data/streams/{stationId}/segment-NNN.ts) and DATA_DIR constant"
  - phase: 03-detection-pipeline
    provides: "AirplayEvent model with snippetUrl field, BullMQ worker lifecycle pattern"
provides:
  - "resolveSegments() maps detection timestamps to ring buffer segment files with seek offset"
  - "R2 client singleton with uploadToR2() and getPresignedUrl() helpers"
  - "processSnippetJob() extracts 5s AAC clips via FFmpeg and uploads to R2"
  - "startSnippetWorker() BullMQ worker with concurrency 2 for CPU-bound encoding"
  - "SNIPPET_QUEUE constant for queue name"
affects: [04-02-PLAN, 05-authentication, 06-ios-app]

# Tech tracking
tech-stack:
  added: ["@aws-sdk/client-s3 ^3.1009", "@aws-sdk/s3-request-presigner ^3.1009"]
  patterns: ["FFmpeg spawn with concat protocol for MPEG-TS segment extraction", "R2 client with lazy validation (stub when SNIPPETS_ENABLED=false)", "Segment mtime-based timestamp resolution"]

key-files:
  created:
    - apps/api/src/lib/segment-resolver.ts
    - apps/api/src/lib/r2.ts
    - apps/api/src/workers/snippet.ts
    - apps/api/tests/lib/segment-resolver.test.ts
    - apps/api/tests/lib/r2.test.ts
    - apps/api/tests/workers/snippet.test.ts
  modified:
    - apps/api/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Segment mtime-based timestamp resolution: file mtime is source of truth for segment time range (not filename numbering) due to segment_wrap cycling"
  - "R2 client lazy validation: when SNIPPETS_ENABLED is false, r2Client is null and functions throw if called, avoiding startup crash when R2 credentials are missing"
  - "FFmpeg -ss as input option (before -i) for fast seeking combined with re-encoding for sample-accurate extraction"
  - "Temp file path uses os.tmpdir() with unique prefix per job to avoid conflicts between concurrent extractions"

patterns-established:
  - "R2 upload pattern: S3Client singleton with PutObjectCommand for upload, getSignedUrl for presigned URLs"
  - "Segment resolver pattern: readdir + stat + mtime filtering for ring buffer timestamp resolution"
  - "Snippet extraction pattern: FFmpeg concat protocol with -ss/-t for precise window extraction"

requirements-completed: [INFR-03, INFR-04]

# Metrics
duration: 4min
completed: 2026-03-15
---

# Phase 4 Plan 1: Segment Resolver, R2 Client, and Snippet Worker Summary

**Segment resolver maps detection timestamps to ring buffer files, R2 client handles Cloudflare uploads/presigning, and BullMQ snippet worker orchestrates FFmpeg extraction + R2 upload + DB update pipeline**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-15T00:04:03Z
- **Completed:** 2026-03-15T00:08:06Z
- **Tasks:** 2 (TDD)
- **Files modified:** 8

## Accomplishments
- Segment resolver correctly maps detection timestamps to ring buffer segment files using mtime-based resolution
- R2 client provides upload and presigned URL generation for Cloudflare R2 with lazy validation for kill switch compatibility
- Snippet worker extracts 5-second AAC 128kbps clips via FFmpeg, uploads to R2, and updates AirplayEvent.snippetUrl
- SNIPPETS_ENABLED kill switch, missing segment handling, and temp file cleanup in all code paths
- Full TDD test coverage: 23 tests across 3 test files (7 segment-resolver + 4 R2 + 12 snippet worker)

## Task Commits

Each task was committed atomically:

1. **Task 1: Segment resolver and R2 client with tests** - `5dfb5e0` (feat)
2. **Task 2: Snippet extraction worker with tests** - `9988d37` (feat)

## Files Created/Modified
- `apps/api/src/lib/segment-resolver.ts` - Maps detection timestamp to segment file paths and seek offset
- `apps/api/src/lib/r2.ts` - R2 client singleton, upload helper, presigned URL generator
- `apps/api/src/workers/snippet.ts` - BullMQ snippet extraction worker with FFmpeg + R2 pipeline
- `apps/api/tests/lib/segment-resolver.test.ts` - Unit tests for segment timestamp resolution (7 tests)
- `apps/api/tests/lib/r2.test.ts` - Unit tests for R2 upload and presign (4 tests)
- `apps/api/tests/workers/snippet.test.ts` - Unit tests for snippet worker extraction pipeline (12 tests)
- `apps/api/package.json` - Added @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner
- `pnpm-lock.yaml` - Updated lockfile with 101 new packages

## Decisions Made
- Segment mtime-based timestamp resolution: file mtime is source of truth for segment time range (not filename numbering) due to segment_wrap cycling
- R2 client lazy validation: when SNIPPETS_ENABLED is false, r2Client is null and functions throw if called, avoiding startup crash when R2 credentials are missing
- FFmpeg -ss as input option (before -i) for fast seeking combined with re-encoding for sample-accurate extraction
- Temp file path uses os.tmpdir() with unique prefix per job to avoid conflicts between concurrent extractions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

R2 credentials and bucket configuration required before enabling snippets. Environment variables needed:
- `R2_ACCOUNT_ID` - Cloudflare Account ID
- `R2_ACCESS_KEY_ID` - R2 API token access key
- `R2_SECRET_ACCESS_KEY` - R2 API token secret key
- `R2_BUCKET_NAME` - R2 bucket name (e.g., myfuckingmusic-snippets)
- `SNIPPETS_ENABLED` - Set to 'true' to enable snippet capture

## Next Phase Readiness
- Segment resolver, R2 client, and snippet worker are ready for integration
- Plan 04-02 will wire the snippet queue into the detection worker and supervisor, and add the presigned URL API endpoint
- No blockers for next plan

## Self-Check: PASSED

All 6 created files verified on disk. Both task commits (5dfb5e0, 9988d37) verified in git log.

---
*Phase: 04-audio-snippet-system*
*Completed: 2026-03-15*
