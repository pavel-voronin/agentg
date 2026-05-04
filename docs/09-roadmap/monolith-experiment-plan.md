# Monolith Experiment Plan

This branch turns AgenTG into one Node.js application:

- one `package.json`
- one `src/`
- one Node.js process
- one SQLite database
- one in-memory event bus
- trusted in-process plugins
- no Docker runtime
- no npm workspaces or `packages/*` architecture
- no internal tRPC
- no NATS
- no Postgres requirement at runtime

## Hard Decisions

- `packages/*` is removed as an architecture boundary.
- Docker Compose, Dockerfiles, NATS scripts, and Postgres runtime scripts are removed.
- Internal tRPC is removed completely.
- Internal calls use direct TypeScript service interfaces.
- Events use an in-memory pub/sub bus.
- Storage is SQLite-first.
- Media and files live in a filesystem blob store, not SQLite blobs.
- Plugins load in-process from `src/plugins`.
- Control Plane and Gateway remain external edge APIs and call app services directly.
- Capability configuration is static configuration, not runtime extension registration.

## Target Structure

```text
src/
  main.ts
  app/
    createApp.ts
    config.ts
    lifecycle.ts
  bus/
    eventBus.ts
    events.ts
  td-data/
  storage/
    sqlite.ts
    migrations/
    schema.ts
  domains/
    telegram/
      telegramService.ts
      telegramRepository.ts
      tdlibClient.ts
      normalize.ts
      files.ts
      migrations.ts
    history/
      historyService.ts
      historyRepository.ts
      reconciler.ts
      coverage.ts
      ranges.ts
  plugins/
    registry.ts
    types.ts
    summaries/
      plugin.ts
      repository.ts
  edges/
    control-plane/
      server.ts
      client/
    gateway/
      server.ts
```

## Stage Rules

Each stage starts with a short re-plan against the current repository state.
Each stage ends with a conventional commit using an allowed project scope.
No stage may add a compatibility layer, fallback path, legacy branch, or duplicated old/new runtime.
If a stage appears to require one, the implementation stops and the stage is re-planned.

## Stages

### Stage 0: Branch and Plan

- Create `codex/monolith-experiment`.
- Add this staged migration plan.
- Commit only the plan.

Exit check:

- `git branch --show-current` returns `codex/monolith-experiment`.
- Plan exists in `docs/09-roadmap/monolith-experiment-plan.md`.

### Stage 1: Root Runtime Skeleton

- Replace the root package model with a single application package.
- Remove npm workspace declarations.
- Keep one set of root scripts: `dev`, `build`, `typecheck`, `lint`, `test`, `check`, and formatting scripts.
- Add a SQLite driver.
- Keep Vue/Vite dependencies needed by the Control Plane UI in the root package.
- Create `src/main.ts`, `src/app/createApp.ts`, `src/app/config.ts`, and `src/app/lifecycle.ts`.
- Create `src/bus/eventBus.ts` and `src/bus/events.ts`.
- `createApp()` wires config, SQLite placeholder, event bus, repositories placeholder, services placeholder, plugins placeholder, and edge server placeholders.

Exit check:

- `npm install`
- `npm run typecheck`
- `npm test`

### Stage 2: SQLite Storage Foundation

- Add `src/storage/sqlite.ts`, `src/storage/schema.ts`, and `src/storage/migrations`.
- Use one database file, `agentg.sqlite`, by default.
- Enable WAL.
- Establish one migration flow for all domains and plugins.
- Prefix tables by owner: `telegram_*`, `history_*`, `summaries_*`, and `pluginName_*`.
- Add repository-level tests on temporary SQLite databases.

Exit check:

- `npm run typecheck`
- `npm test`

### Stage 3: Telegram Domain

- Move useful Telegram code from `packages/telegram/src` into `src/domains/telegram`.
- Remove Telegram tRPC server/client code from runtime.
- Keep TDLib behind `TelegramService`.
- Expose direct methods such as `getChat()` and `getMessage()`.
- Store media and files through filesystem blob storage.
- Prevent raw TDLib DTO leakage from public service DTOs.

Exit check:

- `npm run typecheck`
- `npm test`
- Telegram read DTO test proves no raw leakage.

### Stage 4: History Domain

- Move controller, reconciler, coverage, ranges, jobs, and observability logic from `packages/history-sync`.
- Replace Telegram tRPC client usage with injected `TelegramService`.
- Replace NATS events with the in-memory event bus.
- Persist history data through SQLite repositories.

Exit check:

- `npm run typecheck`
- `npm test`
- Integration test runs `createApp()` with temporary SQLite.

### Stage 5: Summaries Plugin

- Move Summaries into `src/plugins/summaries`.
- Remove capability registration and extension registration.
- Load it as a trusted in-process plugin.
- Pass dependencies directly: `eventBus`, `historyService`, `telegramService`, and repository.
- Add plugin loading tests.

Exit check:

- `npm run typecheck`
- `npm test`

### Stage 6: Edge APIs

- Move Control Plane server into `src/edges/control-plane`.
- Keep the Control Plane UI in the repo and build it from the root package.
- Remove History tRPC client usage.
- Move Gateway WebSocket into `src/edges/gateway`.
- Make Gateway methods call services and plugins directly.
- Make capabilities statically configured.

Exit check:

- `npm run typecheck`
- `npm run lint`
- `npm test`

### Stage 7: Remove Old Runtime Infrastructure

- Delete `packages/`.
- Delete `docker-compose.yml` and `Dockerfile`.
- Delete `scripts/compose-*`.
- Delete source audit rules about packages and tRPC.
- Delete package-level drizzle configs and obsolete package-level migrations.
- Update architecture docs so they describe only the monolith target.

Exit check:

- `rg "packages/" package.json tsconfig.json eslint.config.js docs src tests` returns no runtime references.
- `rg "@trpc|trpc|nats|docker compose|postgres" package.json src tests scripts docs` returns no runtime dependency references.

### Stage 8: Full Verification and Real Event Smoke

- `npm install`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run dev` starts one Node.js application.
- With a real Telegram session, receive one real Telegram event.
- Connected Claude plugin reacts once and exits.

Exit check:

- Docker is not required.
- Postgres is not required.
- NATS is not required.
- tRPC is absent from runtime dependencies.
- Internal calls use direct TypeScript interfaces.
- Events use the in-memory event bus.
- Persistent data is written to SQLite.
