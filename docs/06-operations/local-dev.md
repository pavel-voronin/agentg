# Local Development

Local development uses separate workspace packages for the long-running
Telegram ingestion process, History Sync, Control Plane, and the Agent Gateway,
with Docker Compose providing Postgres and NATS.

## Commands

```bash
npm install
npm run infra:up
npm run db:migrate
npm run dev:service-directory
npm run dev:telegram
npm run dev:history-sync
npm run dev:gateway
npm run dev:summaries
npm run dev:control-plane-server
npm run dev:control-plane
```

`npm run infra:up` starts Postgres and NATS.

`npm run db:migrate` applies versioned Drizzle migrations owned by Telegram,
History Sync, and Summaries.

`npm run dev:telegram` runs the `@agentg/telegram` ingestion package. It owns the
TDLib session, receives live Telegram updates, writes Telegram-shaped records to
Postgres, publishes live integration events to NATS, and serves the narrow
Telegram history fetch RPC surface used by History Sync. It joins Service
Directory with its advertised RPC URL, procedures, and events.

`npm run dev:history-sync` runs the `@agentg/history-sync` package. It owns
history templates, concrete chat targets, coverage intervals, backfill jobs, and
the history sync lifecycle. It joins Service Directory and resolves Telegram
through the local Service Directory snapshot before internal tRPC calls.

`npm run dev:summaries` runs the `@agentg/summaries` pilot module. It owns
`summaries_*` tables, subscribes to Telegram and History events for summary
invalidation, exposes `summaries.*` tRPC methods, and joins Service Directory
with its procedures, events, and `summaries.chatSummary` extension declaration.

`npm run dev:service-directory` runs the `@agentg/service-directory` package.
It stores active service manifests, publishes version invalidations, and serves
the current topology snapshot.

`npm run dev:control-plane-server` runs the server-side Control Plane boundary.
It serves the browser-facing operator WebSocket on `127.0.0.1:8789`, subscribes
to live NATS events, and resolves History Sync and Telegram through Service
Directory before internal tRPC calls.

`npm run dev:control-plane` runs the Vite browser UI on `127.0.0.1:8788`. Its
`/ws` path is proxied to the Control Plane server during development.

`npm run dev:gateway` runs the `@agentg/gateway` package. It subscribes to live
NATS events and serves the external agent WebSocket boundary. Gateway currently
exposes only `telegram.getChat`, resolves Telegram through Service Directory,
and forwards only `telegram.login.completed`. Operator views do not require
Gateway.

## Internal RPC Addresses

Telegram and History Sync start package-owned internal tRPC HTTP servers.
Service Directory is the only direct discovery URL. Services join it with their
manifest; consumers resolve procedures from the local snapshot before making
internal tRPC calls.

Local development defaults:

- Telegram internal RPC bind: `TELEGRAM_RPC_HOST=127.0.0.1`,
  `TELEGRAM_RPC_PORT=18081`
- Telegram advertised service URL: `TELEGRAM_RPC_URL=http://127.0.0.1:18081`
- History internal RPC bind: `HISTORY_RPC_HOST=127.0.0.1`,
  `HISTORY_RPC_PORT=18082`
- History advertised service URL: `HISTORY_RPC_URL=http://127.0.0.1:18082`
- Service Directory internal RPC bind:
  `SERVICE_DIRECTORY_RPC_HOST=127.0.0.1`,
  `SERVICE_DIRECTORY_RPC_PORT=18084`
- Services to Service Directory URL:
  `SERVICE_DIRECTORY_RPC_URL=http://127.0.0.1:18084`
- Summaries internal RPC bind: `SUMMARIES_RPC_HOST=127.0.0.1`,
  `SUMMARIES_RPC_PORT=18083`
- Summaries module URL: `MODULE_RPC_URL=http://127.0.0.1:18083`
- Control Plane server bind: `CONTROL_PLANE_HOST=127.0.0.1`,
  `CONTROL_PLANE_PORT=8789`

Docker Compose uses internal service DNS names:

- Telegram binds `0.0.0.0:8080` inside its container.
- History Sync binds `0.0.0.0:8080` inside its container.
- Service Directory binds `0.0.0.0:8080` inside its container.
- Summaries binds `0.0.0.0:8080` inside its container.
- Telegram, History Sync, and Summaries join `http://service-directory:8080`.
- History Sync, Gateway, Control Plane, and Summaries resolve service RPC URLs
  from Service Directory snapshots.
- Control Plane exposes the browser UI on `${CONTROL_PLANE_PORT:-8788}`.

Run the containerized Telegram ingestion path when validating Docker packaging:

```bash
npm run compose:telegram
```

## Trusted Module Runtime Conventions

Trusted modules run as ordinary internal services. The service name should equal
the module slug, and the slug should prefix tables, extension names, NATS
subjects, and logs.

Module runtime environment:

- `MODULE_SLUG`: stable module slug, for example `summaries`
- `MODULE_RPC_HOST`: bind host inside the container, usually `0.0.0.0`
- `MODULE_RPC_PORT`: internal RPC port, usually `8080`
- `MODULE_RPC_URL`: internal service URL, for example `http://summaries:8080`
- `MODULE_TABLE_PREFIX`: owned table prefix, for example `summaries_`
- `MODULE_MIGRATION_FOLDER`: module-owned Drizzle migration folder
- `DATABASE_URL`: shared Postgres connection string
- `NATS_URL`: shared NATS connection string
- `SERVICE_DIRECTORY_RPC_URL`: Service Directory URL for service manifest join

Extension RPC names are namespaced by slug and are declared in the service
manifest sent to Service Directory. Model extension getters target the model
marker value, for example `telegram.chat`.

Docker Compose includes a `module-smoke` profile with the `modulesmoke` service.
It is a packaging smoke service for the module environment shape, not a product
module:

```bash
docker compose --profile module-smoke up --build modulesmoke
```

Run the pilot summaries module through Compose:

```bash
npm run compose:summaries
```

## Inspecting Service Directory

The current Service Directory snapshot is exposed through
`@agentg/service-directory/rpc`:

```bash
npx tsx -e "
import { createServiceDirectoryClient } from '@agentg/service-directory/rpc';
const client = createServiceDirectoryClient({
  url: process.env.SERVICE_DIRECTORY_RPC_URL ?? 'http://127.0.0.1:18084'
});
console.log(JSON.stringify(await client.refresh(), null, 2));
client.close();
"
```

Service Directory stores active service manifests only. It does not call domain
or module RPC methods.

Core services register with `required: true`: Telegram ingestion, History Sync,
Gateway, and Control Plane. Summaries registers with `required: false`.
Disappearing required services trigger graceful shutdown in Service Directory
clients. Disappearing optional services only removes their procedures and
extensions from snapshots.

## Debugging `callId` Flows

RPC methods publish `rpc.{target}.{lifecycle}` events with one `callId` per
invocation by default. To inspect one procedure flow, subscribe to that target
in NATS directly:

```bash
node --input-type=module -e "
import { connect, StringCodec } from 'nats';
const nc = await connect({ servers: process.env.NATS_URL ?? 'nats://127.0.0.1:4222' });
const codec = StringCodec();
for await (const msg of nc.subscribe('rpc.history.getChatHistoryState.>')) {
  console.log(codec.decode(msg.data));
}
"
```

Then:

1. Invoke the subscribed RPC method, for example `history.getChatHistoryState`.
   Use `rpc.history.requestSync.>` or
   `rpc.summaries.summaries.requestSummary.>` when inspecting those targets.
2. Correlate `rpc.{target}.started`, optional `rpc.{target}.progress`,
   `rpc.{target}.completed`, and `rpc.{target}.failed` by `event.data.callId`.

These events are not durable. If a client disconnects, recover state through the
owning domain or module RPC surface.

## Expected Services

Initial local stack includes:

- Telegram ingestion process backed by TDLib
- History Sync process
- Service Directory process
- Summaries pilot module
- Control Plane server and browser UI for operator views
- Agent Gateway process when testing agent-facing APIs
- Postgres
- NATS

## Phase 1 Manual Validation

The first local validation should prove that Telegram connectivity and Postgres
persistence work end to end.

Expected flow:

1. Start Postgres and NATS with `npm run infra:up`.
2. Apply migrations with `npm run db:migrate`.
3. Start Telegram ingestion with `npm run dev:telegram`.
4. Start History Sync with `npm run dev:history-sync`.
5. Authenticate as the Telegram user if no session exists.
6. Confirm that chats, messages, history targets, and coverage appear in Postgres.
7. Send a text message to Saved Messages from the normal Telegram client.
8. Query Postgres and verify that the same message was persisted with Telegram
   chat and message identifiers.

The same check should also work for a newly received text message from another
chat.

## Useful Low-Noise Commands

```bash
npm run db:ps
npm run db:logs
npm run db:down
```
