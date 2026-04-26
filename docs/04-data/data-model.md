# Data Model

The data model starts from Telegram, not from a generic message abstraction.

The first implementation should focus on Postgres tables needed to inspect connectivity and text-oriented message ingestion: chats, users or senders, raw events, messages, replies, timestamps, identifiers, sync progress, and basic attachment metadata.

## Stores

```text
telegram_events
telegram_messages
telegram_chats
telegram_users
telegram_files
telegram_reactions
telegram_topics
telegram_sync_state
```

For the first implementation, the minimum practical subset is:

```text
telegram_events
telegram_messages
telegram_chats
telegram_users
telegram_sync_state
```

Add more tables when the Telegram data being ingested needs them.

## Telegram-Shaped Foundation

The foundational data model should preserve Telegram semantics:

- chats
- users
- participants
- messages
- edits
- deletes
- reactions
- media and files metadata
- replies and threads
- forum topics
- service events
- permissions and chat metadata
- Telegram API identifiers

## Raw Event Log

`telegram_events` stores append-only Telegram event facts, ideally close enough to TDLib/Telegram semantics to support replay, debugging, and future API coverage.

Purpose:

- replay
- debugging
- normalization rebuild
- audit

## Current State

`telegram_messages` stores the current canonical message state after edits, deletes, reactions, and normalization.

Purpose:

- direct SQL inspection
- thread retrieval
- evidence lookup
- later API reads

## Sync State

`telegram_sync_state` tracks historical backfill progress and live-update checkpoints per chat where needed.

Purpose:

- resume backfill after restart
- avoid repeated historical fetches
- inspect sync progress per chat
- separate live update ingestion from historical sync
