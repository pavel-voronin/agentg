# Local Development

Local development uses separate workspace packages for the long-running
Telegram ingestion process, History Sync, and the Agent Gateway, with Docker
Compose providing Postgres and NATS.

## Commands

```bash
npm install
npm run infra:up
npm run db:migrate
npm run dev:telegram
npm run dev:history-sync
npm run dev:gateway
```

`npm run infra:up` starts Postgres and NATS.

`npm run db:migrate` applies versioned Drizzle migrations from
`packages/database/drizzle/`.

`npm run dev:telegram` runs the `@agentg/telegram` ingestion package. It owns the
TDLib session, receives live Telegram updates, writes Telegram-shaped records to
Postgres, publishes live integration events to NATS, and serves the narrow
Telegram history fetch RPC surface used by History Sync.

`npm run dev:history-sync` runs the `@agentg/history-sync` package. It owns
history templates, concrete chat targets, coverage intervals, backfill jobs, and
the history sync lifecycle. It talks to Telegram ingestion through NATS RPC.

`npm run dev:gateway` runs the `@agentg/gateway` package. It subscribes to live
NATS events and serves WebSocket clients with Postgres-backed read RPCs.

Run the containerized Telegram ingestion path when validating Docker packaging:

```bash
npm run compose:telegram
```

## Expected Services

Initial local stack includes:

- Telegram ingestion process backed by TDLib
- History Sync process
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
