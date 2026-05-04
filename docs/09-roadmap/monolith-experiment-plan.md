# Monolith Experiment Plan

This branch turns AgenTG into one local Node.js application:

- one root package
- one `src/` tree
- one Node.js process
- one SQLite database
- one in-memory event bus
- trusted in-process plugins
- external WebSocket edges for Control Plane and Gateway

## Hard Rules

- The legacy workspace tree is removed as an architecture boundary.
- Internal calls use direct TypeScript service interfaces.
- Internal events use the in-memory event bus.
- Storage is SQLite-first.
- Telegram media and files live in the filesystem blob store.
- Plugins load in-process from `src/plugins`.
- `src/domains/*` is not used; domain modules live directly under `src/<domain>`.
- Capability configuration is static configuration.
- `npm run dev` uses a watcher and reloads on runtime source changes.

## Target Structure

```text
src/
  main.ts
  app/
  bus/
  storage/
  telegram/
  history/
  plugins/
    summaries/
  edges/
    control-plane/
    gateway/
```

## Stage Rules

Each stage starts with a short re-plan against the current repository state.
Each stage ends with a conventional commit using an allowed project scope.
No stage may add a compatibility layer, fallback path, legacy branch, or
duplicated old/new runtime.

## Stages

### Stage 0: Branch and Plan

- Create `codex/monolith-experiment`.
- Add this staged migration plan.
- Commit only the plan.

### Stage 1: Root Runtime Skeleton

- Replace the root package model with a single application package.
- Keep one set of root scripts.
- Add the SQLite driver.
- Create the app bootstrap, config, lifecycle, and event bus.

### Stage 2: SQLite Storage Foundation

- Add SQLite open/close code.
- Enable WAL.
- Establish one migration stream.
- Add temporary-file SQLite tests.

### Stage 3: Telegram

- Move Telegram runtime code into `src/telegram`.
- Keep TDLib behind `TelegramService`.
- Expose direct service methods.
- Store public DTOs without raw TDLib leakage.

### Stage 4: History

- Move History runtime code into `src/history`.
- Inject `TelegramService` directly.
- Replace brokered events with the in-memory event bus.
- Persist History data through SQLite repositories.

### Stage 5: Summaries Plugin

- Move Summaries into `src/plugins/summaries`.
- Load it as a trusted in-process plugin.
- Pass dependencies directly.
- Add plugin loading tests.

### Stage 6: Edge APIs

- Move Control Plane server into `src/edges/control-plane`.
- Move Gateway WebSocket into `src/edges/gateway`.
- Make edge methods call services and plugins directly.
- Make capabilities statically configured.

### Stage 7: Remove Old Runtime Infrastructure

- Delete the legacy workspace tree.
- Delete container runtime files and helper scripts.
- Delete obsolete source audit rules.
- Delete stale architecture documents for replaced behavior.
- Keep docs focused on the current monolith target.

### Stage 8: Full Verification and Real Event Smoke

- `npm install`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run dev`
- Receive one real Telegram event.
- Verify the connected Claude plugin reacts once and exits.
- Verify Control Plane receives runtime events.
- Verify Control Plane UI works against the monolith edge server.

Exit state:

- Internal calls use direct TypeScript interfaces.
- Events use the in-memory event bus.
- Persistent data is written to SQLite.
- The app starts with one watched dev command.
