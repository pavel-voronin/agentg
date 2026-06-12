# TDLib Adapter Boundary

The TDLib adapter is private to the Telegram module. It is responsible for
Telegram login/session, update collection, and upstream Telegram operations used
by Telegram's own domain procedures.

## Boundary

TDLib must not be exposed as a module boundary. Dashboard, Gateway, History Sync,
and other modules must not call TDLib-shaped operations, choose TDLib methods,
pass TDLib cursors, or depend on TDLib response shapes.

Consumers call Telegram domain procedures. Telegram then decides internally
whether it can answer from its own storage, needs to materialize data from TDLib,
or needs to complete work asynchronously and publish a Telegram-owned event.

## Responsibilities

- Login as the user through Telegram API / TDLib.
- Maintain Telegram session and local TDLib database.
- Receive updates.
- Fetch chat lists.
- Fetch historical messages.
- Feed raw updates into Telegram ingestion.
- Provide minimal health and status information.
- Serve as a private implementation dependency for Telegram-owned domain
  procedures.

## Candidate Outputs

```json
{
  "source": "tdlib",
  "update_id": "...",
  "update_type": "updateNewMessage",
  "received_at": "2026-04-25T10:00:01+08:00",
  "payload": {}
}
```

## Non-Responsibilities

- No product-level interpretation of messages.
- No bulk attachment processing.
- No public module RPC surface.
- No thin wrappers exposed to other domains.
