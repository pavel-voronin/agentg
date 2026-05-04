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

Run local development with one command:

```sh
npm run dev
```

`npm run dev` starts the monolith watcher and the live Control Plane UI. The UI
runs through Vite with HMR at `http://127.0.0.1:8790/` and proxies `/ws` to the
monolith Control Plane WebSocket edge. The app watcher reloads on runtime source
changes. The command prints the browser URL, edge URLs, and Telegram connection
state at startup:

```json
{
  "event": "agentg.dev.starting",
  "controlPlaneUiUrl": "http://127.0.0.1:8790/",
  "controlPlaneWsUrl": "ws://127.0.0.1:8789/ws",
  "gatewayUrl": "ws://127.0.0.1:8787/",
  "telegramConfigured": true
}
```

In dev mode, Control Plane and Gateway are enabled by default unless the
corresponding environment variables explicitly disable them.

Open this URL during development:

```text
http://127.0.0.1:8790/
```

## Runtime Shape

`src/app/createApp.ts` wires config, SQLite, event bus, repositories, services,
plugins, and edge servers. Internal calls use direct TypeScript interfaces.

Main modules:

- `src/telegram`: Telegram service, repository, TDLib adapter, normalization,
  file store, and migrations.
- `src/history`: History service, repository, coverage, ranges, reconciler, and
  jobs.
- `src/plugins/summaries`: trusted in-process summaries plugin.
- `src/edges/control-plane`: Control Plane WebSocket edge and UI client.
- `src/edges/gateway`: external Gateway WebSocket edge.

Persistent data is stored in SQLite owner-prefixed tables:

- `telegram_*`
- `history_*`
- `summaries_*`

External edge APIs are WebSocket boundaries. Inside the process they call app
services and plugins directly.
