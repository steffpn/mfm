# Phase 1: Project Foundation - Research

**Researched:** 2026-03-14
**Domain:** Monorepo scaffolding, PostgreSQL/TimescaleDB schema, Prisma ORM, Fastify backend, iOS project setup
**Confidence:** HIGH

## Summary

Phase 1 establishes the entire development environment and database schema for myFuckingMusic. The critical discovery is that **Prisma has shipped version 7** with major breaking changes: ESM-only, required driver adapters (`@prisma/adapter-pg`), a new `prisma.config.ts` file replacing `datasource.url` in schema files, and generated client output no longer going to `node_modules`. All tutorials and examples from pre-2026 are outdated. The planner must use Prisma 7 patterns exclusively.

TimescaleDB integration with Prisma remains a manual process -- Prisma has no native TimescaleDB support. The proven pattern is: define regular tables in `schema.prisma`, generate migrations with `--create-only`, then hand-edit migration SQL to add `CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`, `create_hypertable()` calls, and continuous aggregate definitions. Since the project uses snake_case database naming (PostgreSQL convention), Prisma models should use `@@map("snake_case_name")` and `@map("column_name")` to map PascalCase model names to snake_case tables.

Turborepo 2.x with pnpm 10.x is the standard monorepo stack. The iOS project lives alongside backend code but is not managed by Turborepo (Xcode handles its own build). BullMQ 5.x with Redis 7 provides job queue infrastructure needed by later phases but should be set up now in Docker Compose so the development environment is complete.

**Primary recommendation:** Use Prisma 7 with `@prisma/adapter-pg`, define the full v1 schema upfront with `@@map` for snake_case, and create separate migration files for TimescaleDB-specific SQL (hypertables, continuous aggregates, extension creation).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Turborepo for build orchestration and task caching
- pnpm as package manager
- `apps/api` for backend server, `apps/ios` for Xcode project
- `packages/shared` for TypeScript types and constants (detection events, stations, user roles, enums, status codes)
- Fastify as HTTP framework (high throughput for webhook receivers and detection pipelines)
- REST API with versioned routes under `/api/v1/`
- Prisma as ORM with raw SQL support for TimescaleDB-specific features (hypertables, continuous aggregates)
- BullMQ (Redis-backed) for async job processing (snippet extraction, detection pipelines)
- Full v1 schema created in Phase 1 -- all tables for all 9 phases (stations, detections, users, roles, snippets, invitations)
- TimescaleDB hypertables partitioned by time with 1-day chunks for detection data
- Continuous aggregates defined upfront for daily/weekly/monthly play counts per station, artist, song
- snake_case naming convention for all tables and columns (PostgreSQL convention, no quoting needed)
- MVVM architecture pattern with SwiftUI for iOS
- Minimum deployment target: iOS 17 (@Observable macro, modern SwiftUI APIs)
- Swift Package Manager for dependency management
- Custom API client built on URLSession with async/await (no Alamofire dependency)

### Claude's Discretion
- Docker Compose configuration details
- Exact Prisma schema field types and relations
- Turborepo pipeline configuration
- iOS project folder structure within MVVM pattern
- Redis configuration for BullMQ
- Continuous aggregate refresh policies

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DETC-05 | Detection data is time-partitioned (TimescaleDB) for query performance at scale | TimescaleDB hypertable creation via raw SQL in Prisma migrations; `create_hypertable()` with 1-day chunk interval; continuous aggregates for pre-computed rollups |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Turborepo | 2.8.x | Monorepo build orchestration | Vercel-maintained, fast caching, simple config, industry standard for TS monorepos |
| pnpm | 10.x | Package manager | Symlink-based node_modules, workspace catalogs, fastest install times |
| Fastify | 5.8.x | HTTP framework | Fastest Node.js framework, plugin architecture, native TS support, schema-based validation |
| Prisma | 7.3.x | ORM and migrations | Type-safe queries, migration management, Rust-free v7 client is 3x faster |
| @prisma/adapter-pg | latest | PostgreSQL driver adapter | Required in Prisma 7 -- connects Prisma Client to PostgreSQL via node-pg |
| pg | latest | PostgreSQL driver | Node.js PostgreSQL client, used by Prisma adapter |
| BullMQ | 5.71.x | Job queue | Redis-backed, TypeScript native, battle-tested for background jobs |
| ioredis | latest | Redis client | Required by BullMQ, full Redis protocol support |
| TimescaleDB | latest (pg17) | Time-series extension | PostgreSQL extension for time-partitioned data, continuous aggregates |
| Node.js | 22.x LTS | Runtime | Active LTS through April 2027, stable and widely supported |
| TypeScript | 5.x | Language | Type safety across monorepo, required by Prisma 7 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | latest | Environment variables | Loading .env files for database URLs and config |
| tsx | latest | TypeScript executor | Running seed scripts and ad-hoc TS files (replaces ts-node for ESM) |
| Vitest | latest | Test framework | Unit and integration tests across all packages |
| Docker Compose | v2 | Local services | PostgreSQL/TimescaleDB + Redis for local development |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma 7 | Prisma 6 | v6 is entering maintenance; v7 is 3x faster, smaller bundles, but requires ESM and driver adapters |
| tsx | ts-node | tsx handles ESM natively without configuration; ts-node struggles with ESM |
| Vitest | Jest | Vitest is faster, native ESM, better TS support; Jest requires more config for ESM |

**Installation (apps/api):**
```bash
pnpm add fastify @prisma/client @prisma/adapter-pg pg bullmq ioredis dotenv
pnpm add -D prisma @types/pg typescript tsx vitest
```

## Architecture Patterns

### Recommended Project Structure
```
myFuckingMusic/
├── turbo.json                    # Turborepo task configuration
├── pnpm-workspace.yaml           # Workspace package declarations
├── package.json                  # Root scripts, devDependencies
├── docker-compose.yml            # TimescaleDB + Redis
├── .env                          # Local environment variables (gitignored)
├── .env.example                  # Template for environment variables
├── apps/
│   ├── api/
│   │   ├── package.json          # "type": "module", Fastify + Prisma deps
│   │   ├── tsconfig.json         # ESM config, extends shared base
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Full v1 database schema
│   │   │   └── migrations/       # Generated + custom SQL migrations
│   │   ├── prisma.config.ts      # Prisma 7 configuration
│   │   ├── generated/
│   │   │   └── prisma/           # Generated Prisma client (output target)
│   │   └── src/
│   │       ├── index.ts          # Fastify server entry point
│   │       ├── lib/
│   │       │   ├── prisma.ts     # PrismaClient singleton with adapter
│   │       │   └── redis.ts      # Redis/BullMQ connection
│   │       ├── routes/
│   │       │   └── v1/           # Versioned API routes
│   │       ├── services/         # Business logic
│   │       ├── plugins/          # Fastify plugins
│   │       └── schemas/          # Zod or JSON Schema validation
│   └── ios/
│       └── myFuckingMusic/       # Xcode project
│           ├── myFuckingMusic.xcodeproj
│           ├── App/
│           │   └── myFuckingMusicApp.swift
│           ├── Models/           # Data models
│           ├── ViewModels/       # @Observable view models
│           ├── Views/            # SwiftUI views
│           ├── Services/         # API client, networking
│           ├── Utilities/        # Extensions, helpers
│           └── Resources/        # Assets, Info.plist
├── packages/
│   ├── shared/
│   │   ├── package.json          # "type": "module"
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts          # Barrel export
│   │       ├── types/
│   │       │   ├── detection.ts  # Detection event types
│   │       │   ├── station.ts    # Station types
│   │       │   ├── user.ts       # User and role types
│   │       │   ├── snippet.ts    # Audio snippet types
│   │       │   └── invitation.ts # Invitation types
│   │       ├── enums/
│   │       │   ├── roles.ts      # UserRole enum
│   │       │   └── status.ts     # Status codes
│   │       └── constants/
│   │           └── index.ts      # Shared constants
│   └── tsconfig/
│       ├── package.json
│       ├── base.json             # Shared TypeScript base config
│       └── api.json              # API-specific TS config
```

### Pattern 1: Prisma 7 with Driver Adapter
**What:** Prisma 7 requires explicit driver adapters instead of its old Rust query engine
**When to use:** Every database connection in the project
**Example:**
```typescript
// Source: Prisma 7 official docs
// apps/api/src/lib/prisma.ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };
```

### Pattern 2: Prisma 7 Configuration File
**What:** New `prisma.config.ts` replaces datasource URL in schema
**When to use:** Required for all Prisma 7 projects
**Example:**
```typescript
// Source: Prisma 7 official docs
// apps/api/prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

### Pattern 3: Prisma Schema with snake_case Mapping
**What:** PascalCase Prisma models mapped to snake_case PostgreSQL tables
**When to use:** All models in the schema
**Example:**
```prisma
// Source: Prisma docs + project convention
model Detection {
  id            Int       @id @default(autoincrement())
  stationId     Int       @map("station_id")
  detectedAt    DateTime  @map("detected_at")
  songTitle     String    @map("song_title")
  artistName    String    @map("artist_name")
  isrc          String?
  confidence    Float
  durationMs    Int       @map("duration_ms")
  createdAt     DateTime  @default(now()) @map("created_at")

  station       Station   @relation(fields: [stationId], references: [id])

  @@map("detections")
}
```

### Pattern 4: TimescaleDB Hypertable Migration
**What:** Custom SQL migration to convert table to hypertable
**When to use:** After Prisma creates the base table
**Example:**
```sql
-- Source: TimescaleDB docs + Prisma custom migration pattern
-- prisma/migrations/YYYYMMDDHHMMSS_timescaledb_setup/migration.sql

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Convert detections table to hypertable with 1-day chunks
SELECT create_hypertable('detections', 'detected_at',
  chunk_time_interval => INTERVAL '1 day'
);

-- Create continuous aggregate for daily play counts per station
CREATE MATERIALIZED VIEW daily_station_plays
WITH (timescaledb.continuous) AS
SELECT
  station_id,
  time_bucket('1 day', detected_at) AS bucket,
  COUNT(*) AS play_count,
  COUNT(DISTINCT song_title) AS unique_songs
FROM detections
GROUP BY station_id, bucket
WITH NO DATA;

-- Add refresh policy: refresh last 3 days every hour
SELECT add_continuous_aggregate_policy('daily_station_plays',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);
```

### Pattern 5: Docker Compose for Local Development
**What:** TimescaleDB and Redis containers
**When to use:** Local development environment
**Example:**
```yaml
# Source: TimescaleDB Docker docs + BullMQ docs
# docker-compose.yml
services:
  db:
    image: timescale/timescaledb:latest-pg17
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: mfm
      POSTGRES_PASSWORD: mfm_local
      POSTGRES_DB: myfuckingmusic
      TS_TUNE_MAX_BG_WORKERS: 8
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mfm -d myfuckingmusic"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  redisdata:
```

### Pattern 6: Turborepo Task Configuration
**What:** Modern turbo.json using `tasks` (not legacy `pipeline`)
**When to use:** Root turbo.json configuration
**Example:**
```jsonc
// Source: Turborepo 2.x official docs
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "generate": {
      "cache": false
    }
  }
}
```

### Anti-Patterns to Avoid
- **Using Prisma 6 patterns with v7:** Do NOT put `url = env("DATABASE_URL")` in `datasource` block of schema.prisma. Use `prisma.config.ts` instead.
- **Generating Prisma Client to node_modules:** In v7, always specify `output` in the generator block. The old default location is gone.
- **Using `pipeline` key in turbo.json:** Renamed to `tasks` in Turborepo 2.x. The old key still works but is deprecated.
- **Running `prisma generate` automatically:** In Prisma 7, `migrate dev` no longer auto-runs `generate`. Always run it explicitly after migrations.
- **Putting TimescaleDB SQL in schema.prisma:** Prisma has no native TimescaleDB support. Always use custom SQL migration files.
- **Using PascalCase table names with TimescaleDB:** Quote-escaping PascalCase names in raw SQL is error-prone. Use `@@map` for snake_case.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Database migrations | Custom SQL scripts with version tracking | Prisma Migrate | Tracks migration history, generates SQL from schema, supports custom SQL via `--create-only` |
| Job queue | Custom Redis pub/sub system | BullMQ | Handles retries, dead letter queues, concurrency, rate limiting, job priorities |
| Monorepo task orchestration | Custom shell scripts for build ordering | Turborepo | Dependency-aware task execution, intelligent caching, parallelization |
| Time-series partitioning | Manual table partitioning | TimescaleDB hypertables | Automatic chunk management, query optimization, transparent partition pruning |
| Pre-computed aggregates | Cron jobs with manual rollup tables | TimescaleDB continuous aggregates | Incremental materialization, automatic refresh, query-transparent |
| TypeScript project references | Manual build ordering | Turborepo + pnpm workspaces | Handles dependency graph, caching, parallel builds |

**Key insight:** This phase is pure infrastructure -- every component has mature tooling. Custom solutions here create maintenance debt that compounds across all 9 phases.

## Common Pitfalls

### Pitfall 1: Prisma 7 ESM Configuration
**What goes wrong:** `ERR_REQUIRE_ESM` errors, import failures, generated client not found
**Why it happens:** Prisma 7 is ESM-only. Missing `"type": "module"` in package.json or wrong tsconfig module settings.
**How to avoid:** Every package that uses Prisma must have `"type": "module"` in package.json, `"module": "ESNext"` and `"moduleResolution": "bundler"` in tsconfig.json, and all imports must include `.js` extensions for relative paths.
**Warning signs:** Any `require()` call, missing `.js` in import paths, `"module": "commonjs"` in tsconfig.

### Pitfall 2: TimescaleDB Extension Not Loaded Before Hypertable Creation
**What goes wrong:** `function create_hypertable(regclass, name) does not exist`
**Why it happens:** The `CREATE EXTENSION` and `create_hypertable()` are in the same migration, but the extension isn't fully initialized.
**How to avoid:** Place `CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;` in the very first migration (before table creation). Put `create_hypertable()` calls in a separate, later migration that runs after tables exist.
**Warning signs:** Migration errors referencing missing functions.

### Pitfall 3: Prisma Migrate Drift with TimescaleDB
**What goes wrong:** `prisma migrate dev` detects "drift" because hypertables modify the table structure in ways Prisma doesn't understand.
**Why it happens:** Prisma compares the actual database schema against its expected state. TimescaleDB hypertable conversion adds internal metadata that Prisma sees as unexpected changes.
**How to avoid:** Always use `prisma migrate dev --create-only` to generate migrations, review them, then apply. Never rely on automatic migration application with TimescaleDB. Consider using `prisma migrate deploy` for applying known-good migrations.
**Warning signs:** Prisma prompting to reset the database during development.

### Pitfall 4: Continuous Aggregates on Empty Tables
**What goes wrong:** `WITH DATA` (the default) on continuous aggregates fails or hangs on empty hypertables.
**Why it happens:** TimescaleDB tries to materialize data that doesn't exist yet.
**How to avoid:** Always use `WITH NO DATA` when creating continuous aggregates in migrations. The refresh policy will populate them when data arrives.
**Warning signs:** Migration hangs or takes unexpectedly long.

### Pitfall 5: Prisma 7 Generated Client Output Path
**What goes wrong:** Imports from `@prisma/client` fail or return undefined.
**Why it happens:** Prisma 7 no longer generates to `node_modules/@prisma/client`. The `output` field in `generator` is now required and defaults to a project directory.
**How to avoid:** Set `output = "../generated/prisma"` in the generator block. Import from `../../generated/prisma/client.js` (relative path with .js extension). Add `generated/` to `.gitignore`.
**Warning signs:** Empty `@prisma/client` module, missing type definitions.

### Pitfall 6: pnpm Workspace Hoisting Conflicts
**What goes wrong:** Dependencies not found, version conflicts between packages.
**Why it happens:** pnpm's strict isolation can cause packages to not find dependencies installed in sibling packages.
**How to avoid:** Use `workspace:*` protocol for internal dependencies. Define shared dependency versions via pnpm catalogs in `pnpm-workspace.yaml`. Be explicit about which packages depend on what.
**Warning signs:** Module not found errors that work in one package but not another.

### Pitfall 7: Forgetting `prisma generate` After Migrations
**What goes wrong:** TypeScript types don't match database schema, runtime errors.
**Why it happens:** Prisma 7 removed automatic client generation from `migrate dev`. Developers forget to run `generate` separately.
**How to avoid:** Add a `postmigrate` script or always chain commands: `prisma migrate dev && prisma generate`. Include `generate` as a Turborepo task.
**Warning signs:** Type errors in IDE after schema changes, stale Prisma Client types.

## Code Examples

### Prisma Schema Generator Block (Prisma 7)
```prisma
// Source: Prisma 7 official docs
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

### pnpm-workspace.yaml
```yaml
# Source: pnpm docs
packages:
  - "apps/*"
  - "packages/*"
```

### Root package.json
```json
{
  "name": "myfuckingmusic",
  "private": true,
  "packageManager": "pnpm@10.6.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "db:migrate": "pnpm --filter api exec prisma migrate dev",
    "db:generate": "pnpm --filter api exec prisma generate",
    "db:studio": "pnpm --filter api exec prisma studio"
  },
  "devDependencies": {
    "turbo": "^2.8.0"
  }
}
```

### apps/api/package.json
```json
{
  "name": "api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "generate": "prisma generate"
  },
  "dependencies": {
    "@myfuckingmusic/shared": "workspace:*",
    "@prisma/adapter-pg": "^7.3.0",
    "@prisma/client": "^7.3.0",
    "bullmq": "^5.71.0",
    "dotenv": "^16.4.0",
    "fastify": "^5.8.0",
    "ioredis": "^5.4.0",
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0",
    "prisma": "^7.3.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

### Fastify Server Entry Point
```typescript
// Source: Fastify 5.x official docs
// apps/api/src/index.ts
import Fastify from "fastify";

const server = Fastify({
  logger: true,
});

// Health check
server.get("/health", async () => {
  return { status: "ok" };
});

// API v1 routes will be registered as plugins
// server.register(import("./routes/v1/index.js"), { prefix: "/api/v1" });

const start = async () => {
  try {
    await server.listen({ port: 3000, host: "0.0.0.0" });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
```

### Shared Types Example
```typescript
// Source: project convention
// packages/shared/src/types/detection.ts

export interface DetectionEvent {
  id: number;
  stationId: number;
  detectedAt: Date;
  songTitle: string;
  artistName: string;
  isrc: string | null;
  confidence: number;
  durationMs: number;
  createdAt: Date;
}

export interface DetectionCreate {
  stationId: number;
  detectedAt: Date;
  songTitle: string;
  artistName: string;
  isrc?: string;
  confidence: number;
  durationMs: number;
}
```

### TimescaleDB Continuous Aggregate Examples
```sql
-- Source: TimescaleDB official docs
-- Daily play counts per station
CREATE MATERIALIZED VIEW daily_station_plays
WITH (timescaledb.continuous) AS
SELECT
  station_id,
  time_bucket('1 day', detected_at) AS bucket,
  COUNT(*) AS play_count,
  COUNT(DISTINCT song_title) AS unique_songs,
  COUNT(DISTINCT artist_name) AS unique_artists
FROM detections
GROUP BY station_id, bucket
WITH NO DATA;

SELECT add_continuous_aggregate_policy('daily_station_plays',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);

-- Weekly play counts per artist
CREATE MATERIALIZED VIEW weekly_artist_plays
WITH (timescaledb.continuous) AS
SELECT
  artist_name,
  time_bucket('7 days', detected_at) AS bucket,
  COUNT(*) AS play_count,
  COUNT(DISTINCT station_id) AS station_count
FROM detections
GROUP BY artist_name, bucket
WITH NO DATA;

SELECT add_continuous_aggregate_policy('weekly_artist_plays',
  start_offset => INTERVAL '14 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '6 hours'
);

-- Monthly play counts per song
CREATE MATERIALIZED VIEW monthly_song_plays
WITH (timescaledb.continuous) AS
SELECT
  song_title,
  artist_name,
  isrc,
  time_bucket('30 days', detected_at) AS bucket,
  COUNT(*) AS play_count,
  COUNT(DISTINCT station_id) AS station_count
FROM detections
GROUP BY song_title, artist_name, isrc, bucket
WITH NO DATA;

SELECT add_continuous_aggregate_policy('monthly_song_plays',
  start_offset => INTERVAL '90 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day'
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma 6 with Rust query engine | Prisma 7 with TypeScript-native client + driver adapters | January 2026 | Must use `prisma.config.ts`, ESM-only, `@prisma/adapter-pg`, explicit `output` in generator |
| `pipeline` key in turbo.json | `tasks` key in turbo.json | Turborepo 2.x (2024) | `pipeline` still works but deprecated; use `tasks` |
| ts-node for TypeScript execution | tsx for ESM-compatible TS execution | 2024-2025 | tsx handles ESM without config; ts-node requires complex setup |
| Prisma generates to node_modules | Prisma generates to project directory | Prisma 7 (Jan 2026) | Must set `output` field, import from generated path |
| pnpm 9.x | pnpm 10.x with catalogs | 2025 | Catalog feature for centralized version management |
| TimescaleDB on pg14/15 | TimescaleDB on pg17 | 2025 | `latest-pg17` Docker tag now available |

**Deprecated/outdated:**
- `prisma-client-js` generator provider: replaced by `prisma-client` in v7
- `datasource.url` in schema.prisma: moved to `prisma.config.ts`
- `--skip-generate` and `--skip-seed` flags: removed in Prisma 7
- Automatic seeding on `prisma migrate dev`: removed in v7
- `pipeline` key in turbo.json: renamed to `tasks` in Turborepo 2.x

## Open Questions

1. **Prisma 7 TimescaleDB Migration Stability**
   - What we know: Custom SQL migrations with `create_hypertable()` work when extension is loaded first. The `--create-only` workflow is unchanged in v7.
   - What's unclear: Whether Prisma 7's new driver adapter introduces any new issues with TimescaleDB-specific SQL in migrations. Previous issues were with the Rust engine; the new TypeScript engine may behave differently.
   - Recommendation: Test the full migration flow early in implementation. Create a minimal reproduction before building the full schema.

2. **Prisma 7 with `generated/` Directory in Monorepo**
   - What we know: Prisma 7 generates to a project directory, not node_modules. The generated code needs to be importable by the API package.
   - What's unclear: How this interacts with Turborepo caching and pnpm workspace resolution.
   - Recommendation: Add `generated/` to `.gitignore` and make `prisma generate` a Turborepo task that runs before `build`. Test that other packages can import from the generated path.

3. **iOS Project in Monorepo**
   - What we know: Xcode manages its own build system. The iOS project lives in `apps/ios/` but is not orchestrated by Turborepo.
   - What's unclear: Whether the Xcode project should be a flat directory or nested. Swift Package Manager integration within the monorepo structure.
   - Recommendation: Keep the Xcode project self-contained in `apps/ios/`. Do not try to make Turborepo manage Swift builds. The iOS project shares types conceptually but not as build dependencies.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `apps/api/vitest.config.ts` (Wave 0) |
| Quick run command | `pnpm --filter api test` |
| Full suite command | `turbo run test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DETC-05 | Detection data stored in TimescaleDB hypertable with time partitioning | integration | `pnpm --filter api test -- tests/db/hypertable.test.ts` | Wave 0 |
| FOUND-01 (implicit) | Prisma migrations apply successfully | integration | `pnpm --filter api test -- tests/db/migration.test.ts` | Wave 0 |
| FOUND-02 (implicit) | Shared types are importable from packages/shared | unit | `pnpm --filter shared test -- tests/types.test.ts` | Wave 0 |
| FOUND-03 (implicit) | Fastify server starts and responds to health check | smoke | `pnpm --filter api test -- tests/server.test.ts` | Wave 0 |
| FOUND-04 (implicit) | Docker Compose services start and are reachable | smoke | Manual verification via `docker compose up -d && docker compose ps` | Manual-only: infrastructure test |

### Sampling Rate
- **Per task commit:** `pnpm --filter api test`
- **Per wave merge:** `turbo run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/vitest.config.ts` -- Vitest configuration for API package
- [ ] `apps/api/tests/db/hypertable.test.ts` -- Verifies detections table is a hypertable (DETC-05)
- [ ] `apps/api/tests/db/migration.test.ts` -- Verifies all migrations apply cleanly
- [ ] `apps/api/tests/server.test.ts` -- Verifies Fastify server starts
- [ ] `packages/shared/vitest.config.ts` -- Vitest configuration for shared package
- [ ] `packages/shared/tests/types.test.ts` -- Verifies type exports
- [ ] Framework install: `pnpm add -D vitest` in api and shared packages

## Sources

### Primary (HIGH confidence)
- [Prisma 7 official docs](https://www.prisma.io/docs/prisma-orm/quickstart/postgresql) -- Full v7 setup, driver adapters, prisma.config.ts, migration workflow
- [Prisma 7 upgrade guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions) -- Breaking changes, ESM requirement, removed features
- [Prisma 7 announcement](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0) -- Rust-free client, performance improvements
- [Prisma custom migrations docs](https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations) -- `--create-only` workflow for raw SQL
- [Turborepo structuring docs](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository) -- apps/packages layout, workspace config
- [Turborepo configuration reference](https://turborepo.dev/docs/reference/configuration) -- turbo.json tasks syntax
- [TimescaleDB CREATE MATERIALIZED VIEW docs](https://docs.timescale.com/api/latest/continuous-aggregates/create_materialized_view/) -- Continuous aggregate syntax
- [TimescaleDB Docker Hub](https://hub.docker.com/r/timescale/timescaledb) -- Image tags, pg17 support
- [BullMQ npm](https://www.npmjs.com/package/bullmq) -- v5.71.x, TypeScript native
- [Fastify TypeScript docs](https://fastify.dev/docs/latest/Reference/TypeScript/) -- v5 type system

### Secondary (MEDIUM confidence)
- [Prisma + TimescaleDB GitHub issue #3228](https://github.com/prisma/prisma/issues/3228) -- Community workarounds, confirms no native support
- [Prisma + TimescaleDB migration issue #10388](https://github.com/prisma/prisma/issues/10388) -- Known `create_hypertable` migration issues
- [Prisma + TimescaleDB blog (Medium)](https://medium.com/geekculture/set-up-a-timescaledb-hypertable-with-prisma-9550652cfe97) -- Practical setup guide
- [Vitest Turborepo guide](https://turborepo.dev/docs/guides/tools/vitest) -- Test setup in monorepo

### Tertiary (LOW confidence)
- [Node.js 24 LTS](https://nodesource.com/blog/nodejs-24-becomes-lts) -- Node 24 is LTS, but Node 22 is safer for Prisma 7 compatibility (needs validation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All versions verified via npm/official docs, Prisma 7 changes thoroughly documented
- Architecture: HIGH -- Turborepo monorepo structure is well-documented, Prisma 7 patterns verified from official quickstart
- Pitfalls: HIGH -- Prisma/TimescaleDB integration issues confirmed across multiple GitHub issues and community reports
- TimescaleDB continuous aggregates: MEDIUM -- Syntax verified from official docs, but refresh policy tuning is empirical

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (30 days -- stack is stable, Prisma 7 is new but documented)
