# Local Development

Local development uses separate workspace packages for the long-running
Telegram ingestion process, History Sync, Control Plane, and the Agent Gateway,
with Docker Compose providing Postgres and NATS.

## Commands

```bash
npm install
npm run infra:up
npm run db:migrate
npm run dev:telegram
npm run dev:history-sync
npm run dev:extension-registry
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
Telegram history fetch RPC surface used by History Sync.

`npm run dev:history-sync` runs the `@agentg/history-sync` package. It owns
history templates, concrete chat targets, coverage intervals, backfill jobs, and
the history sync lifecycle. It talks to Telegram ingestion through internal tRPC.

`npm run dev:summaries` runs the `@agentg/summaries` pilot module. It owns
`summaries_*` tables, subscribes to Telegram and History events for summary
invalidation, exposes `summaries.*` tRPC methods, registers
`summaries.requestChatSummary` with Gateway, and registers
`summaries.chatSummary` against `telegram.chat` in Extension Registry.

`npm run dev:extension-registry` runs the `@agentg/extension-registry` package.
It stores and lists active `{ target, extension }` registrations only.

`npm run dev:control-plane-server` runs the server-side Control Plane boundary.
It serves the browser-facing operator WebSocket on `127.0.0.1:8789`, subscribes
to live NATS events, and calls History Sync through internal tRPC.

`npm run dev:control-plane` runs the Vite browser UI on `127.0.0.1:8788`. Its
`/ws` path is proxied to the Control Plane server during development.

`npm run dev:gateway` runs the `@agentg/gateway` package. It subscribes to live
NATS events, serves external agent WebSocket clients with Postgres-backed
Telegram reads, calls History Sync through internal tRPC, and can compose
extension views when configured with Extension Registry and extension service
URLs. Operator views do not require Gateway.

## Internal RPC Addresses

Telegram and History Sync start package-owned internal tRPC HTTP servers. History
Sync calls Telegram for chat discovery, stable Telegram read facts, and
historical page fetches. Gateway calls Telegram for Telegram reads and History
Sync for history commands and reads. Control Plane server calls History Sync
while keeping the browser-facing WebSocket protocol unchanged.

Local development defaults:

- Telegram internal RPC bind: `TELEGRAM_RPC_HOST=127.0.0.1`,
  `TELEGRAM_RPC_PORT=18081`
- History internal RPC bind: `HISTORY_RPC_HOST=127.0.0.1`,
  `HISTORY_RPC_PORT=18082`
- History to Telegram URL: `TELEGRAM_RPC_URL=http://127.0.0.1:18081`
- Gateway to Telegram URL: `TELEGRAM_RPC_URL=http://127.0.0.1:18081`
- Gateway to History URL: `HISTORY_RPC_URL=http://127.0.0.1:18082`
- Extension Registry internal RPC bind:
  `EXTENSION_REGISTRY_RPC_HOST=127.0.0.1`,
  `EXTENSION_REGISTRY_RPC_PORT=18084`
- Gateway to Extension Registry URL:
  `EXTENSION_REGISTRY_RPC_URL=http://127.0.0.1:18084`
- Gateway to Summaries URL: `SUMMARIES_RPC_URL=http://127.0.0.1:18083`
- Summaries internal RPC bind: `SUMMARIES_RPC_HOST=127.0.0.1`,
  `SUMMARIES_RPC_PORT=18083`
- Summaries module URL: `MODULE_RPC_URL=http://127.0.0.1:18083`
- Summaries to Gateway URL: `GATEWAY_RPC_URL=ws://127.0.0.1:8787`
- Summaries to Extension Registry URL:
  `EXTENSION_REGISTRY_RPC_URL=http://127.0.0.1:18084`
- Control Plane server bind: `CONTROL_PLANE_HOST=127.0.0.1`,
  `CONTROL_PLANE_PORT=8789`
- Control Plane server to History URL:
  `HISTORY_RPC_URL=http://127.0.0.1:18082`

Docker Compose uses internal service DNS names:

- Telegram binds `0.0.0.0:8080` inside its container.
- History Sync binds `0.0.0.0:8080` inside its container.
- History Sync calls `http://telegram:8080`.
- Gateway calls `http://telegram:8080` and `http://history-sync:8080`.
- Extension Registry binds `0.0.0.0:8080` inside its container.
- Gateway calls `http://extension-registry:8080` for extension registration
  reads.
- Summaries binds `0.0.0.0:8080` inside its container.
- Summaries calls `ws://gateway:8787` and
  `http://extension-registry:8080`.
- Gateway calls `http://summaries:8080` when composing
  `summaries.chatSummary`.
- Control Plane server calls `http://history-sync:8080` and exposes the browser
  UI on `${CONTROL_PLANE_PORT:-8788}`.

Run the containerized Telegram ingestion path when validating Docker packaging:

```bash
npm run compose:telegram
```

## Trusted Module Runtime Conventions

Trusted modules run as ordinary internal services. The service name should equal
the module slug, and the slug should prefix tables, capability names, extension
names, NATS subjects, and logs.

Module runtime environment:

- `MODULE_SLUG`: stable module slug, for example `summaries`
- `MODULE_RPC_HOST`: bind host inside the container, usually `0.0.0.0`
- `MODULE_RPC_PORT`: internal RPC port, usually `8080`
- `MODULE_RPC_URL`: internal service URL, for example `http://summaries:8080`
- `MODULE_TABLE_PREFIX`: owned table prefix, for example `summaries_`
- `MODULE_MIGRATION_FOLDER`: module-owned Drizzle migration folder
- `DATABASE_URL`: shared Postgres connection string
- `NATS_URL`: shared NATS connection string
- `GATEWAY_RPC_URL`: Gateway WebSocket URL for capability registration
- `EXTENSION_REGISTRY_RPC_URL`: registry URL for extension registration
- needed domain URLs such as `TELEGRAM_RPC_URL` or `HISTORY_RPC_URL`

Capability names are namespaced by slug, for example
`summaries.requestChatSummary`. Extension RPC names follow the same convention
and are registered directly with Extension Registry at startup, then refreshed
periodically. Model extension getters target the model marker value, for example
`telegram.chat`.

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

## Inspecting Registries

Gateway capabilities are exposed through the external WebSocket API:

```bash
node --input-type=module -e "
import { WebSocket } from 'ws';
const ws = new WebSocket('ws://127.0.0.1:8787');
ws.on('open', () => ws.send(JSON.stringify({ id: 'capabilities', method: 'capabilities.list' })));
ws.on('message', (data) => { console.log(data.toString()); ws.close(); });
"
```

Extension registrations are exposed through Extension Registry tRPC:

```bash
npx tsx -e "
import { createTRPCUntypedClient, httpBatchLink } from '@trpc/client';
const client = createTRPCUntypedClient({
  links: [httpBatchLink({ url: process.env.EXTENSION_REGISTRY_RPC_URL ?? 'http://127.0.0.1:18084' })]
});
console.log(JSON.stringify(await client.query('listExtensions', { target: 'telegram.chat' }), null, 2));
"
```

The registry response is direct data. Extension Registry stores active
registrations only; it does not call extension RPC methods.

## Debugging `callId` Flows

RPC methods publish `{target}.{lifecycle}` events with one `callId` per
invocation by default. To inspect one procedure flow, subscribe to that target
in NATS directly:

```bash
node --input-type=module -e "
import { connect, StringCodec } from 'nats';
const nc = await connect({ servers: process.env.NATS_URL ?? 'nats://127.0.0.1:4222' });
const codec = StringCodec();
for await (const msg of nc.subscribe('history.getChatHistoryState.>')) {
  console.log(codec.decode(msg.data));
}
"
```

Then:

1. Invoke the subscribed RPC method, for example `history.getChatHistoryState`.
   Use `history.requestSync.>` or `summaries.summaries.requestSummary.>` when
   inspecting those targets.
2. Correlate `{target}.started`, optional `{target}.progress`,
   `{target}.completed`, and `{target}.failed` by `event.data.callId`.

These events are not durable. If a client disconnects, recover state through the
owning domain or module RPC surface.

## Expected Services

Initial local stack includes:

- Telegram ingestion process backed by TDLib
- History Sync process
- Extension Registry process
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
