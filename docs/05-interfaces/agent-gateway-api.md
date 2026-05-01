# Agent Gateway API

## Purpose

Agent Gateway is the external API boundary for an agent-side MCP plugin.

The plugin connects to Gateway over WebSocket. Gateway keeps NATS internal, applies the external protocol boundary, forwards live integration events, and serves small RPC-style read commands against Postgres.

Gateway is a separate workspace package at `packages/gateway`. Telegram
ingestion is a separate workspace package at `packages/telegram`. History Sync
is a separate workspace package at `packages/history-sync`.

## Runtime

```text
Telegram ingestion
  -> Postgres
  -> NATS Core subjects

History Sync
  -> Postgres history tables
  <-> NATS RPC to Telegram ingestion

Agent Gateway
  <- NATS Core subjects
  -> WebSocket clients
  -> Postgres read RPC for Telegram reads
  <-> NATS RPC for History Sync
```

Start locally:

```sh
docker compose up -d postgres nats
npm run dev:telegram
npm run dev:history-sync
npm run dev:gateway
```

History observability page:

```text
http://127.0.0.1:8787/history
```

Start Gateway from Docker:

```sh
docker compose --profile gateway up gateway
```

Configuration:

- `NATS_URL`, default `nats://localhost:4222`
- `AGENT_GATEWAY_HOST`, default `127.0.0.1`
- `AGENT_GATEWAY_PORT`, default `8787`
- `AGENT_GATEWAY_TOKEN`, optional query-string token

When `AGENT_GATEWAY_TOKEN` is set, connect with:

```text
ws://127.0.0.1:8787/?token=...
```

## Event Envelope

Gateway notifications use the integration event envelope:

```json
{
  "event": {
    "id": "evt_...",
    "type": "telegram.message.created",
    "source": "telegram",
    "occurredAt": "2026-04-26T10:00:00.000Z",
    "data": {},
    "meta": {}
  }
}
```

The envelope is stable. `data` remains JSON and intentionally does not require a schema registry.

## NATS Subjects

Current subjects match event types:

- `telegram.chat.updated`
- `telegram.message.created`
- `telegram.message.updated`
- `telegram.message.deleted`

These events are live integration signals. They are not durable and are not a replay log. Reconnect recovery should use Gateway RPC methods backed by Postgres.

## RPC Protocol

Client requests are JSON objects:

```json
{
  "id": "req_1",
  "method": "telegram.listRecentMessages",
  "params": {
    "limit": 20
  }
}
```

Responses:

```json
{
  "id": "req_1",
  "result": {}
}
```

Errors:

```json
{
  "id": "req_1",
  "error": {
    "code": "method_failed",
    "message": "Unknown method: example"
  }
}
```

## Methods

`telegram.getMessage`

```json
{
  "chatId": "123",
  "messageId": "456"
}
```

`telegram.listRecentMessages`

```json
{
  "chatId": "123",
  "limit": 50
}
```

`chatId` is optional. `limit` defaults to `50` and is capped at `200`.

`telegram.searchMessages`

```json
{
  "query": "invoice",
  "chatId": "123",
  "limit": 20
}
```

`chatId` is optional. `limit` defaults to `20` and is capped at `100`.

`telegram.getChat`

```json
{
  "chatId": "123"
}
```

## History Observability Methods

Gateway exposes these methods over WebSocket, but the API implementation belongs
to the History Sync domain. Gateway sends `history.*` methods to
`agentg.command.history.rpc` over NATS and does not own history range, coverage,
target, or job semantics.

`history.getOverview`

Returns chat, template, target, coverage, and job counters.

`history.listChats`

```json
{
  "query": "optional title or id filter",
  "limit": 200
}
```

`history.getChatHistoryState`

```json
{
  "chatId": "123"
}
```

Returns the selected chat, targets, projected desired intervals, coverage,
missing intervals, and jobs.

`history.upsertTarget`

```json
{
  "chatId": "123",
  "preset": "last30d"
}
```

Supported presets are `last7d`, `last30d`, and `full`. A custom target can use
`start` and `end` strings such as `past`, `now-30d`, `now`, or an absolute date.
Gateway does not write `history_targets` directly. It sends History Sync RPC over
NATS and returns success only after the History Sync process writes the target.
History Sync also emits `history.target.upserted` and wakes its reconciler.

`history.requestSync`

```json
{
  "chatId": "123"
}
```

`chatId` is optional. The command is sent through NATS and consumed by the
History Sync process when it is running.

The History Sync actor is event-driven and single-flight. Startup,
target changes, chat changes, and explicit sync requests wake it. If another
wake-up arrives during a run, it performs another pass after the current run.
There is no periodic polling loop.

## Telegram History RPC

History Sync talks to Telegram ingestion through a narrow internal NATS RPC
surface. History jobs are not exposed to Telegram ingestion.

- `agentg.command.telegram.history.list_chats`: optionally asks Telegram ingestion to
  discover chats through TDLib and returns Telegram-shaped chat metadata.
- `agentg.command.telegram.history.fetch_page`: asks Telegram ingestion to fetch and
  persist one history page for `{ chatId, startAt, endAt, cursorMessageId,
  limit }`. The response is a compact page summary used by History Sync to
  checkpoint its own backfill job and coverage state.
