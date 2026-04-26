# Data Flow

## Main Flow

```text
TDLib update
  -> raw event
  -> Telegram-shaped Postgres records
  -> inspectable chats and messages
```

The first implementation proves that the system can authenticate, receive Telegram data, synchronize the chat list, backfill historical messages, and persist text-oriented chats and messages.

Historical backfill is a mechanism, not a fixed product policy. The system should be able to load older messages; the exact depth can be adjusted for private chats, groups, and channels after real limits are known.
