# Local Development

Local development uses separate workspace packages for the long-running
Telegram ingestion process and the Agent Gateway, with Docker Compose providing
Postgres and NATS.

## Commands

```bash
npm install
npm run infra:up
npm run db:migrate
npm run dev:telegram
npm run dev:gateway
```

`npm run infra:up` starts Postgres and NATS.

`npm run db:migrate` applies versioned Drizzle migrations from
`packages/database/drizzle/`.

`npm run dev:telegram` runs the `@agentg/telegram` ingestion package. It owns the
TDLib session, receives live Telegram updates, writes Telegram-shaped records to
Postgres, publishes live integration events to NATS, runs startup catch-up for
messages received while the worker was offline, and starts resumable historical
backfill in the same process.

Use `BACKFILL_MESSAGE_LIMIT`, `BACKFILL_WINDOW_DAYS`,
`CATCHUP_BOOTSTRAP_LOOKBACK_DAYS`, `CATCHUP_WINDOW_DAYS`, and
`BACKFILL_REQUEST_DELAY_MS` to tune local sync speed.
`BACKFILL_CHAT_LOAD_BATCH_SIZE` controls how many chats TDLib is asked to load
per chat-list discovery request; it is not a cap on total synced chats.

```bash
BACKFILL_MESSAGE_LIMIT=25 BACKFILL_WINDOW_DAYS=7 CATCHUP_WINDOW_DAYS=1 BACKFILL_REQUEST_DELAY_MS=2000 npm run dev:telegram
```

`npm run dev:gateway` runs the `@agentg/gateway` package. It subscribes to live
NATS events and serves WebSocket clients with Postgres-backed read RPCs.

Run the containerized Telegram ingestion path when validating Docker packaging:

```bash
npm run compose:telegram
```

## Expected Services

Initial local stack includes:

- Telegram ingestion process backed by TDLib
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
4. Authenticate as the Telegram user if no session exists.
5. Confirm that chats and historical messages appear in Postgres.
6. Send a text message to Saved Messages from the normal Telegram client.
7. Query Postgres and verify that the same message was persisted with Telegram
   chat and message identifiers.

The same check should also work for a newly received text message from another
chat.

## Useful Low-Noise Commands

```bash
npm run db:ps
npm run db:logs
npm run db:down
```
