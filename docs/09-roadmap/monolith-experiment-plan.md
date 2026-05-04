# Monolith Experiment Plan

This branch turns AgenTG into one local Node.js application. The plan is the
execution contract for the branch and must stay complete until Stage 8 is
verified.

## Goal

- one root `package.json`
- one `src/` tree
- one Node.js process
- one SQLite database
- one in-memory event bus
- trusted in-process plugins
- no container runtime
- no workspaces or package-level architecture
- no internal tRPC
- no brokered internal events
- no required Postgres runtime

Control Plane and Gateway stay external edge APIs. Inside the process they call
application services directly.

## Hard Decisions

- Delete `packages/*` as an architecture unit.
- Delete container runtime files and runtime scripts.
- Delete internal tRPC completely.
- Use TypeScript service interfaces for internal calls.
- Use the in-memory event bus for all internal events.
- Make storage SQLite-first.
- Store Telegram media and files in the filesystem blob store, not SQLite blobs.
- Load plugins in-process from `src/plugins`.
- Do not use `src/domains`; domain modules live directly under `src/<domain>`.
- Keep capabilities statically managed in configuration.
- Keep `npm run dev` as a watcher wrapper that reloads on meaningful runtime
  source changes.

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
  storage/
    sqlite.ts
    migrations/
    schema.ts
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
td-data/
```

## Stage Protocol

- Before each stage, re-plan against the current repository state.
- At the end of each stage, commit with a conventional commit and an allowed
  scope from `AGENTS.md`.
- A stage is not complete while its working tree changes are uncommitted.
- No stage may add a compatibility layer, fallback path, legacy branch, or
  duplicated old/new runtime.
- If a stage appears to need a transitional duplicate implementation, stop and
  re-plan instead of implementing it.

## Stages

### Stage 0: Branch and Plan

- Create `codex/monolith-experiment`.
- Add this staged migration plan.
- Commit only the plan.

Checks:

- `git branch --show-current` prints `codex/monolith-experiment`.
- `git status --short` is clean after the commit.

### Stage 1: Root Runtime Skeleton

- Replace the root package model with a single application package.
- Remove workspaces.
- Keep one root set of scripts: `build`, `test`, `typecheck`, `lint`, `dev`.
- Add the SQLite driver.
- Keep Vue/Vite dependencies because the Control Plane UI stays in this repo.
- Create `src/main.ts`.
- Create `src/app/createApp.ts`.
- Create config and lifecycle code.
- Create the in-memory event bus.
- `main.ts` must wait for SIGINT/SIGTERM so the monolith stays alive; remove
  any temporary keepalive implementation before final verification.

Checks:

- `npm install`
- `npm run typecheck`
- `npm test`
- `npm run dev` starts through the watcher wrapper.

### Stage 2: SQLite Storage Foundation

- Create one SQLite database file named `agentg.sqlite` by default.
- Enable WAL.
- Keep one migration stream under `src/storage/migrations`.
- Add table prefixes:
  - `telegram_*`
  - `history_*`
  - `summaries_*`
  - `<pluginName>_*`
- Add repository/service tests against temporary SQLite files.

Checks:

- SQLite opens file-backed databases only.
- WAL is enabled.
- Migrations are ordered and tracked once.
- `npm run typecheck`
- `npm test`

### Stage 3: Telegram

- Move useful Telegram runtime code into `src/telegram`.
- Remove Telegram tRPC server/client code.
- Keep TDLib inside the Telegram service boundary.
- Expose direct `TelegramService` methods, including:
  - `getChat()`
  - `getMessage()`
- Normalize Telegram DTOs before returning them from the service.
- Store Telegram media/files through the filesystem blob store.

Checks:

- No public Telegram DTO contains raw TDLib payload leakage.
- Telegram persistence uses SQLite `telegram_*` tables.
- Internal Telegram calls are direct TypeScript calls.
- `npm run typecheck`
- `npm test`

### Stage 4: History

- Move controller, reconciler, coverage, ranges, and jobs into `src/history`.
- Replace the Telegram tRPC client with injected `TelegramService`.
- Replace brokered events with event bus pub/sub.
- Persist History data through SQLite `history_*` tables.

Checks:

- History consumes Telegram updates from `eventBus`.
- History calls Telegram through the direct service interface.
- No broker client is required for History.
- `npm run typecheck`
- `npm test`

### Stage 5: Summaries Plugin

- Move Summaries into `src/plugins/summaries`.
- Remove capability registration.
- Remove extension registration.
- Load Summaries as a trusted in-process plugin.
- Pass dependencies directly:
  - `eventBus`
  - `historyService`
  - `telegramService`
  - `repository`
- Persist Summaries data through SQLite `summaries_*` tables.

Checks:

- Plugin registry loads Summaries in-process.
- Summaries reacts to in-memory events.
- `npm run typecheck`
- `npm test`

### Stage 6: Edge APIs

- Move Control Plane server into `src/edges/control-plane`.
- Move Gateway server into `src/edges/gateway`.
- Keep both as external WebSocket edge APIs.
- Remove History tRPC client usage.
- Make edge methods call services/plugins directly.
- Make Gateway capabilities statically configured.

Checks:

- Control Plane uses direct services behind its WebSocket boundary.
- Gateway uses direct services/plugins behind its WebSocket boundary.
- No internal tRPC dependency is needed at runtime.
- `npm run typecheck`
- `npm test`

### Stage 7: Remove Old Runtime Infrastructure

- Delete `packages/`.
- Delete container runtime files.
- Delete container helper scripts.
- Delete obsolete source-audit rules for package or tRPC architecture.
- Delete package-local runtime configs for replaced behavior.
- Delete stale architecture documents for replaced behavior.
- Keep current docs focused only on the monolith target.

Checks:

- `git ls-files '*Docker*' '*docker*' '*compose*'` prints nothing.
- `find . -maxdepth 2 -type d -name packages -print` prints nothing.
- `find . -maxdepth 2 -type d -name scripts -print` prints nothing.
- `find . -maxdepth 3 -type d -name domains -print` prints nothing.
- `rg -n 'packages/|@agentg/|@trpc|\\btrpc\\b|\\bNATS\\b|\\bnats\\b|Postgres|postgres|docker compose|Dockerfile|docker-compose' package.json package-lock.json tsconfig.json eslint.config.js src tests README.md` prints nothing.
- `docker ps --filter label=com.docker.compose.project=agentg --format '{{.Names}}'` prints nothing.
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

### Stage 8: Full Verification and Real Event Smoke

- Re-run the full Definition of Done from a clean working tree.
- Verify `npm run dev` starts the watched monolith command.
- Verify the Control Plane WebSocket receives runtime events.
- Verify the live Control Plane UI works through Vite HMR and proxies to the
  monolith edge.
- Verify one real Telegram event reaches the monolith.
- Verify the external Claude channel plugin receives that event from Gateway, reacts once, and exits.

Checks:

- `npm install`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run dev`
- Control Plane event smoke:
  - start the monolith with the Control Plane edge enabled
  - connect a WebSocket client to the Control Plane edge
  - publish or receive a runtime event
  - confirm the event is delivered to the client
- Control Plane UI smoke:
  - start the live Vite Control Plane UI
  - open the UI in a browser
  - confirm it renders against the monolith edge
- Real Telegram and Claude channel smoke:
  - start the monolith with real Telegram credentials/session
  - start the external Claude channel plugin as an MCP/channel bridge
  - connect that bridge to the monolith Gateway
  - receive one real Telegram update
  - confirm the Claude channel receives and reacts once
  - exit the process after the verified reaction

## Definition of Done

- `npm install` succeeds.
- `npm run typecheck` succeeds.
- `npm run lint` succeeds.
- `npm test` succeeds.
- `npm run build` succeeds.
- `npm run dev` starts the monolith through a watcher.
- The application starts as one Node.js process.
- Docker is not required and no Docker artifacts are tracked in the repo.
- Postgres is not required for runtime.
- Brokered runtime messaging is not required.
- Internal tRPC is absent from runtime dependencies.
- No `packages/` architecture remains.
- No `src/domains/` architecture remains.
- All internal calls go through direct TypeScript service interfaces.
- All internal events go through the in-memory event bus.
- All persistent application data is written to SQLite.
- Telegram media/files are stored in the filesystem blob store.
- Plugins are trusted in-process plugins loaded from `src/plugins`.
- Summaries is loaded as the first in-process plugin.
- Control Plane receives runtime events and the UI works.
- Gateway calls services/plugins directly and uses static capabilities.
- One real Telegram event is received.
- The external Claude channel plugin reacts to that Telegram event once and exits.
