# Data Flow

## Main Flow

```text
TDLib update
  -> TDLib update handler
  -> Telegram domain table records
  -> inspectable chats and messages
```

The first implementation proves that the system can authenticate, receive Telegram data, synchronize the chat list, converge requested history coverage, and persist text-oriented chats and messages.

History Sync is a desired-state loop. Templates materialize concrete chat targets, target ranges project into bounded absolute intervals, and History Sync asks Telegram to ensure those intervals. Telegram stores coverage, computes missing intervals from its own coverage tables, and owns TDLib page continuity.

See [History Sync](../03-domains/historySync.md).
