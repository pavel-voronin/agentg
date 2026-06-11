# Agent Gateway API

## Purpose

Agent Gateway is the external WebSocket API boundary for agent-side clients.
Gateway keeps NATS and internal module RPC services private. It exposes only the
Gateway RPC methods explicitly owned by this document and only the live events
explicitly allowed here.

Gateway does not expose History Sync RPC, capability registration, capability calls,
raw NATS subjects, database rows, or raw TDLib payloads.

## Runtime

```text
Telegram ingestion
  -> Postgres
  -> NATS Core subjects
  <- internal module RPC

Agent Gateway
  <- NATS Core subject telegram.login.completed
  -> WebSocket clients
  <-> typed Telegram internal RPC client for telegram.getChat
```

Start locally:

```sh
docker compose up -d postgres nats
npm run dev:telegram
npm run dev:gateway
```

Configuration:

- `NATS_URL`, default `nats://localhost:4222`
- `GATEWAY_HOST`, default `127.0.0.1`
- `GATEWAY_PORT`, default `8787`
- `GATEWAY_TOKEN`, optional bearer token
- `TELEGRAM_RPC_URL`, default `http://127.0.0.1:8702`

When `GATEWAY_TOKEN` is set, connect with the WebSocket
`Authorization` header:

```text
Authorization: Bearer ...
```

## External Events

Gateway forwards exactly one live integration event to external WebSocket
clients:

- `telegram.login.completed`

The notification payload uses the integration event envelope:

```json
{
  "event": {
    "id": "evt_...",
    "type": "telegram.login.completed",
    "occurredAt": "2026-05-05T00:00:00.000Z",
    "data": {}
  }
}
```

All other NATS subjects remain internal.

## RPC Protocol

Client requests are JSON objects:

```json
{
  "id": "req_1",
  "method": "telegram.getChat",
  "params": {
    "chatId": "123"
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
    "code": "unknown_method",
    "message": "Unknown method: example"
  }
}
```

Gateway error codes:

- `unknown_method`: the external method is not part of Gateway's public API.
- `dependency_unavailable`: the method is allowed, but the internal RPC
  dependency failed at the transport or protocol boundary before returning a
  domain result.
- `method_failed`: the method reached domain logic and failed with a domain
  procedure error.

## Methods

Gateway exposes exactly one external WebSocket RPC method.

`telegram.getChat`

```json
{
  "chatId": "123"
}
```

`telegram.getChat` calls Telegram ingestion through the typed
`@agentg/telegram` internal RPC client and returns Telegram's chat read model.
Gateway does not read Telegram storage directly, does not call TDLib directly,
and does not enrich the result.

Example result:

```json
{
  "chat": {
    "_model": "telegram.chat",
    "id": "123",
    "title": "Saved Messages",
    "type": "private",
    "updatedAt": "2026-05-05T00:00:00.000Z"
  }
}
```
