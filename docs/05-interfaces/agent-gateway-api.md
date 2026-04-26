# Agent Gateway API

## Purpose

Agent Gateway is the external API boundary for an agent-side MCP plugin.

The plugin connects to Gateway over WebSocket. Gateway keeps NATS internal, applies the external protocol boundary, forwards live integration events, and serves small RPC-style read commands against Postgres.

Gateway is a separate workspace package at `packages/gateway`. Telegram ingestion
is a separate workspace package at `packages/telegram`.

## Runtime

```text
Telegram ingestion
  -> Postgres
  -> NATS Core subjects

Agent Gateway
  <- NATS Core subjects
  -> WebSocket clients
  -> Postgres read RPC
```

Start locally:

```sh
docker compose up -d postgres nats
npm run dev:telegram
npm run dev:gateway
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
