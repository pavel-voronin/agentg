# Local Development

Local development uses separate workspace packages for the long-running
Telegram ingestion process, History Sync, Dashboard, and the Agent Gateway,
with Docker Compose providing Postgres, NATS, OpenTelemetry Collector,
VictoriaMetrics, Jaeger, Loki, Grafana, and NATS and Postgres exporters.

## Commands

Install Process Compose before running the local app stack:

```bash
brew install f1bonacc1/tap/process-compose
```

```bash
npm install
npm run dev
```

`npm run dev` starts the local app stack through Process Compose in detached
mode. The Process Compose project is declared in `process-compose.yaml`, uses
`.tmp/process-compose.sock` as its control socket, and writes service logs to
`.tmp/process-compose/services.log`.

Process Compose runs the app-side services:

- `telegram`
- `history-sync`
- `gateway`
- `dashboard-server`
- `dashboard`

It also runs setup commands before the app services:

- `infra-up`, which calls `npm run infra:up`
- `db-migrate`, which calls `npm run db:migrate`

`npm run dev` defaults `AGENTG_TELEMETRY` to `1`, so `npm run infra:up` starts
Postgres, NATS, OpenTelemetry Collector, VictoriaMetrics, Jaeger, Loki,
Grafana, the NATS exporter, and the Postgres exporter through Docker Compose. With
`AGENTG_TELEMETRY=0`,
`npm run infra:up` starts only
Postgres and NATS. These services stay Docker-owned. The observability services
are development tools. Jaeger keeps traces in memory, VictoriaMetrics and Loki
write to `tmpfs`, and Grafana is rebuilt from provisioning files instead of a
persistent volume.

Runtime packages write structured pino JSON to stdout for Process Compose logs
and mirror the same log calls to OpenTelemetry logs when telemetry is enabled.
The local OpenTelemetry Collector receives logs through OTLP HTTP and exports
them to Loki with `otlp_http/loki`. Grafana provisions Loki as a logs datasource
and the Jaeger datasource links traces to Loki by `trace_id`. Loki indexes
runtime logs by the same application service resource labels used by traces and
metrics, such as `service_name="telegram"` and `service_name="history-sync"`.

`npm run db:migrate` applies versioned Drizzle migrations owned by Telegram and
History Sync.

The Telemetry Dashboard page is owned by `@agentg/telemetry`, but its
backend procedures run inside `dashboard-server`; there is no standalone
Telemetry runtime service.

Useful Process Compose commands:

```bash
npm run dev:status
npm run dev:attach
npm run dev:tui
npm run dev:logs -- dashboard-server --tail 100
npm run dev:restart -- telegram
npm run dev:down
```

`npm run dev:tui` starts the same Process Compose project in the foreground TUI
instead of detached mode. `npm run dev:attach` attaches the TUI to an already
running detached project. `npm run dev:down` stops the Process Compose app
services and leaves Docker-owned infrastructure running.

`npm run dev:telegram` runs the `@agentg/telegram` ingestion package. It owns the
TDLib session, receives live Telegram updates, writes Telegram-shaped records to
Postgres, computes Telegram history coverage from fetched and received messages,
publishes live integration events to NATS, and serves Telegram domain procedures.
TDLib operations, page fetches, cursors, coverage convergence, and file
materialization remain private implementation details behind those procedures.

`npm run dev:history-sync` runs the `@agentg/history-sync` package. It owns
history sync templates, concrete chat targets, range projection, and the history sync
lifecycle. It calls Telegram domain procedures through the typed
`@agentg/telegram` client using `TELEGRAM_RPC_URL`; it does not select TDLib,
page-fetch, cursor, or file-materialization behavior.

`npm run dev:dashboard-server` runs the server-side Dashboard boundary.
It serves the browser-facing operator WebSocket on `127.0.0.1:8789`, subscribes
to live NATS events, and exposes Dashboard-owned backend procedures that call
typed History Sync and Telegram clients. It starts after Telegram and History
Sync are ready and does not wait for Gateway.

`npm run dev:dashboard` runs the Vite browser UI on `127.0.0.1:8788`. Its
`/ws` path is proxied to the Dashboard server during development.

`npm run dev:gateway` runs the `@agentg/gateway` package. It subscribes to live
NATS events and serves the external agent WebSocket boundary. Gateway currently
exposes only `telegram.getChat`, calls Telegram through the typed
`@agentg/telegram` client, and forwards only `telegram.login.completed`.
Operator views do not require Gateway.

## Internal RPC Addresses

Telegram and History Sync start package-owned internal HTTP procedure servers.
Consumers know service addresses from the local runtime environment and call
typed clients imported from the serving package root.

Local development defaults:

- Telegram local RPC port: `PORT=8702`
- History Sync local RPC port: `PORT=8704`
- Telegram client URL for local consumers:
  `TELEGRAM_RPC_URL=http://127.0.0.1:8702`
- History Sync client URL for Dashboard server:
  `HISTORY_SYNC_RPC_URL=http://127.0.0.1:8704`
- Dashboard server bind: `DASHBOARD_HOST=127.0.0.1`,
  `DASHBOARD_PORT=8789`

Docker Compose uses internal service DNS names:

- Telegram binds `0.0.0.0:8080` inside its container.
- History Sync binds `0.0.0.0:8080` inside its container.
- History Sync and Gateway use `TELEGRAM_RPC_URL=http://telegram:8080`.
- Dashboard server uses `TELEGRAM_RPC_URL=http://telegram:8080` and
  `HISTORY_SYNC_RPC_URL=http://history-sync:8080`.
- Dashboard binds `0.0.0.0:8080` inside its container.
- Telegram and History Sync expose Docker healthchecks through their internal
  RPC endpoints. Docker Compose waits for Telegram health before starting
  History Sync, Gateway, and Dashboard, and waits for History Sync health before
  starting Dashboard.
- Dashboard does not depend on Gateway in Docker Compose. Gateway may run in the
  same profile, but Gateway failure must not block operator views.
- The Dashboard edge proxy exposes the browser UI on
  `${DASHBOARD_PORT:-8788}` and routes `/telegram-files/` to the Telegram file
  server.

Run the containerized Telegram ingestion path when validating Docker packaging:

```bash
npm run compose:telegram
```

## Trusted Module Runtime Conventions

Trusted modules run as ordinary internal services. The service name should equal
the module slug, and the slug should prefix tables, NATS subjects, and logs.

Module runtime environment:

- `MODULE_SLUG`: stable module slug, for example `analysis`
- `MODULE_RPC_HOST`: bind host inside the container, usually `0.0.0.0`
- `MODULE_RPC_PORT`: internal RPC port, usually `8080`
- `MODULE_RPC_URL`: internal service URL, for example `http://analysis:8080`
- `MODULE_TABLE_PREFIX`: owned table prefix, for example `analysis_`
- `MODULE_MIGRATION_FOLDER`: module-owned Drizzle migration folder
- `DATABASE_URL`: shared Postgres connection string
- `NATS_URL`: shared NATS connection string
- `<OWNER>_RPC_URL`: explicitly configured URL for each consumed internal RPC
  dependency

Docker Compose includes a `module-smoke` profile with the `modulesmoke` service.
It is a packaging smoke service for the module environment shape, not a product
module:

```bash
docker compose --profile module-smoke up --build modulesmoke
```

## Debugging Internal RPC Calls

Internal RPC calls do not publish NATS lifecycle events. Inspect them through
OpenTelemetry traces and RPC duration metrics. Use the procedure name and
`rpc.service` label to filter client and server spans for a specific call path.

Domain facts still travel over NATS. To inspect state changes, subscribe to the
explicit domain subjects such as `history-sync.sync.>` or
`telegram.update.chat.>`.

## Expected Services

Initial local stack includes:

- Telegram ingestion process backed by TDLib
- History Sync process
- Dashboard server and browser UI for operator views
- Agent Gateway process when testing agent-facing APIs
- Postgres
- NATS
- OpenTelemetry Collector
- VictoriaMetrics
- Jaeger
- Loki
- Grafana
- NATS exporter
- Postgres exporter

## Phase 1 Manual Validation

The first local validation should prove that Telegram connectivity and Postgres
persistence work end to end.

Expected flow:

1. Start the local stack with `npm run dev`.
2. Inspect readiness with `npm run dev:status`.
3. Authenticate as the Telegram user if no session exists.
4. Confirm that chats, messages, history sync targets, and coverage appear in Postgres.
5. Send a text message to Saved Messages from the normal Telegram client.
6. Query Postgres and verify that the same message was persisted with Telegram
   chat and message identifiers.

The same check should also work for a newly received text message from another
chat.

## Useful Low-Noise Commands

```bash
npm run db:ps
npm run db:logs
npm run db:down
```
