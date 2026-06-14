# MVP

## Goal

The system can connect to the user's Telegram account, read personal chats, groups, channels, and Saved Messages, and persist text-oriented Telegram data into Postgres so it can be inspected directly.

## Scope

- TDLib sidecar.
- TypeScript/Node.js sidecar if TDLib integration is stable enough.
- Postgres Telegram domain tables.
- Malformed or unhandled TDLib update diagnostics.
- Normalized `telegram_messages`.
- Basic `telegram_chats`.
- Basic `telegram_users` or sender records.
- Authentication and session persistence.
- Reading personal chats, groups, and channels.
- Chat list synchronization.
- Telegram-owned coverage intervals.
- Text messages and text-bearing message content.
- Text visible to the user's normal Telegram client is the primary data target.
- Replies and reply references where available.
- A low-level `sendMessage` client command may exist if it is trivial through TDLib.
- Enough metadata to inspect stored data directly in Postgres.

## Out Of Scope

- Autonomous or agent-triggered sending.
- Complex multi-agent routing.
- Topic-per-chat transport.
- Broad Telegram API coverage.
- Rich media processing beyond basic metadata needed to understand message records.

## MVP Success

- The system can ingest Telegram updates.
- The system can authenticate and resume a Telegram user session.
- Personal chats, groups, and channels can be discovered.
- Telegram can record coverage intervals and compute missing intervals from
  Telegram-owned coverage.
- Live updates and historical fetches both paint the same coverage timeline.
- Incoming text-oriented messages are written to Postgres.
- Replies preserve enough references to reconstruct local context.
- A developer can inspect chats and messages in Postgres and verify that connectivity and persistence work.

## First Live Acceptance Check

The first convincing success signal is database-visible Telegram parity:

1. The user opens the normal Telegram client.
2. The user sends a text message to Saved Messages, or receives a text message in a normal chat.
3. The custom Telegram client receives the same update.
4. A direct Postgres query shows the same message, chat, sender, timestamp, and Telegram identifiers.

If Telegram shows a new message notification but AgenTG does not persist the corresponding message, Phase 1 is not working yet.

## History Coverage

The ideal target is requested visible text history coverage: every text
message, post caption, and text-bearing item requested through Telegram reads
should eventually be represented in AgenTG storage.

Attachments are not part of the initial bulk target. Store enough metadata to know that an attachment exists, but download or process attachment payloads only on request or in later dedicated pipelines.

Telegram computes missing intervals and page continuity when a Telegram-owned
read requires historical materialization.
