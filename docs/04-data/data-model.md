# Data Model

The data model starts from Telegram, not from a generic message abstraction.

The first implementation should focus on Postgres tables needed to inspect connectivity and text-oriented message ingestion: chats, users or senders, raw events, messages, replies, timestamps, identifiers, history coverage, and basic attachment metadata.

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
history_templates
history_targets
history_coverage
backfill_jobs
```

For the first implementation, the minimum practical subset is:

```text
telegram_events
telegram_messages
telegram_chats
telegram_users
telegram_sync_state
history_targets
history_coverage
backfill_jobs
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

## History Sync State

History sync state tracks desired coverage, factual coverage, and executable work.

Purpose:

- store templates that materialize targets for matching chats
- store concrete history targets per chat
- store merged coverage intervals per chat
- resume backfill jobs after restart
- avoid repeated historical fetches for already covered intervals
- inspect target coverage and missing intervals per chat

See [History Sync](../03-domains/history-sync.md).
See [History Sync Schema](history-sync-schema.md) for the pre-implementation
table shape.
