# Data Flow

## Main Flow

```text
TDLib update
  -> TDLib update handler
  -> Telegram domain table records
  -> inspectable chats and messages
```

The first implementation proves that the system can authenticate, receive
Telegram data, synchronize the chat list, converge requested history coverage,
and persist text-oriented chats and messages.

Telegram stores coverage, computes missing intervals from its own coverage
tables, and owns TDLib page continuity. Consumers request Telegram product
reads; they do not select TDLib cursors, page fetch strategy, or coverage
materialization mechanics.
