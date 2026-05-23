# Agent Gateway API

## Purpose

Agent Gateway is the external WebSocket API boundary for agent-side clients.
Gateway keeps NATS and internal tRPC services private. It exposes only the
Gateway RPC methods explicitly owned by this document and only the live events
explicitly allowed here.

Gateway does not expose History Sync RPC, capability registration, capability calls,
extension composition, raw NATS subjects, database rows, or raw TDLib payloads.

## Runtime

```text
Telegram ingestion
  -> Postgres
  -> NATS Core subjects
  <- internal tRPC

Agent Gateway
  <- NATS Core subject telegram.login.completed
  -> WebSocket clients
  <-> Service Directory for Telegram ingestion discovery
  <-> internal tRPC to Telegram ingestion for telegram.getChat
```

Start locally:

```sh
docker compose up -d postgres nats
npm run dev:service-directory
npm run dev:telegram
npm run dev:gateway
```

Configuration:

- `NATS_URL`, default `nats://localhost:4222`
- `AGENT_GATEWAY_HOST`, default `127.0.0.1`
- `AGENT_GATEWAY_PORT`, default `8787`
- `AGENT_GATEWAY_TOKEN`, optional query-string token
- `SERVICE_DIRECTORY_RPC_URL`, default `http://127.0.0.1:18084`

When `AGENT_GATEWAY_TOKEN` is set, connect with:

```text
ws://127.0.0.1:8787/?token=...
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
    "code": "method_failed",
    "message": "Unknown method: example"
  }
}
```

Gateway error codes:

- `unknown_method`: the external method is not part of Gateway's public API.
- `dependency_unavailable`: the method is allowed, but its downstream service is
  absent from the current Service Directory snapshot.
- `method_failed`: the downstream call failed after routing.

## Methods

Gateway exposes exactly one external WebSocket RPC method.

`telegram.getChat`

```json
{
  "chatId": "123"
}
```

`telegram.getChat` resolves the owning service through Service Directory, calls
Telegram ingestion through its internal tRPC client, and returns Telegram's chat
read model. Gateway does not read Telegram storage directly, does not call TDLib
directly, and does not enrich the result.

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
