# AgenTG

AgenTG is a single Node.js application for local Telegram ingestion, history
tracking, summaries, and external WebSocket edges.

Current runtime:

- one root `package.json`
- one `src/` tree
- one Node.js process
- one SQLite database file, `agentg.sqlite`
- one in-memory event bus
- trusted in-process plugins under `src/plugins`
- filesystem storage for Telegram media/files

## Commands

```sh
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run dev` runs the monolith through a watcher and reloads on runtime source
changes.

## Runtime Shape

`src/app/createApp.ts` wires config, SQLite, event bus, repositories, services,
plugins, and edge servers. Internal calls use direct TypeScript interfaces.

Main modules:

- `src/telegram`: Telegram service, repository, TDLib adapter, normalization,
  file store, and migrations.
- `src/history`: History service, repository, coverage, ranges, reconciler, and
  jobs.
- `src/plugins/summaries`: trusted in-process summaries plugin.
- `src/edges/control-plane`: Control Plane WebSocket/static edge.
- `src/edges/gateway`: external Gateway WebSocket edge.

Persistent data is stored in SQLite owner-prefixed tables:

- `telegram_*`
- `history_*`
- `summaries_*`

External edge APIs are WebSocket boundaries. Inside the process they call app
services and plugins directly.
