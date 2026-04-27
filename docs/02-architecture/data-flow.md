# Data Flow

## Main Flow

```text
TDLib update
  -> raw event
  -> Telegram-shaped Postgres records
  -> inspectable chats and messages
```

The first implementation proves that the system can authenticate, receive Telegram data, synchronize the chat list, maintain requested history coverage, and persist text-oriented chats and messages.

History sync is a desired-state loop. Templates materialize concrete chat targets, coverage records which intervals are already covered, and the reconciler derives backfill jobs for missing intervals.

See [History Sync](../03-domains/history-sync.md).
