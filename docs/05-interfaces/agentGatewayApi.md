# Agent Gateway API

## Purpose

Agent Gateway is the external WebSocket API boundary for agent-side clients.
Gateway keeps NATS and internal module RPC services private. It exposes only the
Gateway RPC methods explicitly owned by this document and only the live events
explicitly allowed here.

Gateway does not expose capability registration, capability calls, raw NATS
subjects, database rows, or raw TDLib payloads.

## Runtime

```text
Telegram ingestion
  -> Postgres
  -> NATS Core subjects
  <- internal module RPC

Agent Gateway
  <- NATS Core subject telegram.login.completed
  -> WebSocket clients
  <-> typed Telegram internal RPC client for allowed Telegram methods
  <-> typed Policies internal RPC client for allowed policy control methods
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
- `POLICIES_RPC_URL`, default `http://127.0.0.1:8705`

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
    "at": "2026-05-05T00:00:00.000Z",
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

## Method Rules

Gateway exposes only the explicit methods listed here. It is not a generic
module RPC proxy and it does not expose dynamic capability registration or
arbitrary method calls.

Gateway calls internal modules only through package-owned typed clients. Gateway
does not read module storage, call TDLib, access NATS request/reply, or enrich
module results.

## Telegram Methods

Telegram methods call Telegram ingestion through the typed `@agentg/telegram`
internal RPC client and return Telegram domain procedure results directly.

`telegram.getChat`

```json
{
  "chatId": "123"
}
```

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

`telegram.listRecentMessages`

```json
{
  "beforeMessageId": "1000",
  "chatId": "123",
  "limit": 50
}
```

`telegram.getMessages`

```json
{
  "owner": {
    "kind": "chat",
    "chatId": "123"
  },
  "selector": {
    "kind": "page",
    "limit": 50
  }
}
```

`telegram.searchMessages`

```json
{
  "chatId": "123",
  "limit": 20,
  "query": "policy"
}
```

`telegram.requestFile`

```json
{
  "owner": {
    "_model": "telegram.message",
    "id": "123:456"
  },
  "slotKey": "photo"
}
```

`telegram.resolveSourceContent`

```json
{
  "sourceSelector": {
    "domain": "telegram",
    "selector": {
      "kind": "searchMessages",
      "query": "policy"
    }
  }
}
```

Telegram owns selectors, message readiness, history coverage, file request
decisions, and source content resolution. Gateway only forwards the allowed
domain request and returns the domain result.

## Policy Methods

Policy methods call the typed policy endpoint client from
`@agentg/framework/policies`. `policies` owns document envelopes, validation,
storage, resolved policy values, and policy update events. Module-owned policy
`spec` semantics stay with the module that defines the policy kind.

`policies.listPolicyKinds`

```json
{}
```

`policies.listInstances`

```json
{
  "kind": "TriggerRule",
  "labels": {
    "area": "telegram"
  },
  "moduleId": "triggers"
}
```

`policies.getInstance`

```json
{
  "kind": "TriggerRule",
  "name": "dailyDigest"
}
```

`policies.setInstance`

```json
{
  "document": {
    "apiVersion": "agentg.dev/v1",
    "kind": "TriggerRule",
    "metadata": {
      "name": "dailyDigest"
    },
    "spec": {}
  }
}
```

`policies.deleteInstance`

```json
{
  "kind": "TriggerRule",
  "name": "dailyDigest"
}
```

`policies.getPolicyValue`

```json
{
  "kind": "TriggerRule"
}
```

`setInstance` and `deleteInstance` return policy mutation results. Expected
policy contract failures return `status: "rejected"` in the result body.
Transport and protocol failures return Gateway `dependency_unavailable` errors.
