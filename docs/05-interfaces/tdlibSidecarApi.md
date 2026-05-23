# TDLib Sidecar API

The TDLib sidecar is responsible for Telegram login/session and update collection.

## Boundary

The sidecar should expose a narrow internal API and should not become a product behavior layer.

## Responsibilities

- Login as the user through Telegram API / TDLib.
- Maintain Telegram session and local TDLib database.
- Receive updates.
- Fetch chat lists.
- Fetch historical messages.
- Emit raw updates into ingestion.
- Provide minimal health and status information.
- Optionally expose a low-level `sendMessage` command.

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
