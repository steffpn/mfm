# Phase 05 Deferred Items

## Pre-existing Build Issues (out of scope)

1. **ioredis version mismatch**: BullMQ ships with ioredis@5.9.3 while the direct dependency is ioredis@5.10.0, causing TypeScript type incompatibility in ConnectionOptions. Affects: webhooks/acrcloud/index.ts, workers/detection.ts, workers/cleanup.ts, workers/snippet.ts, services/supervisor/index.ts
2. **Prisma client rootDir**: `generated/prisma/client.ts` is outside `rootDir` (src/), causing TS6059. The Prisma v7 generated client location conflicts with the tsconfig rootDir setting.
3. **prisma.config.ts rootDir**: Was included in tsconfig include but is outside rootDir. Fixed in 05-01 by removing from tsconfig include array (tsconfig fix is in-scope as it blocked verification).
