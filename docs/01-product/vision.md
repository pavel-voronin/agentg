# Vision

AgenTG is a Telegram client for a personal agent.

The personal assistant is external to Telegram and has many information channels: email, bookmarks, local knowledge bases, operating-system context, and Telegram. AgenTG is the Telegram client service for that assistant. It is not a Telegram bot and should not be framed as a conversational bot inside Telegram.

The first milestone is a minimal working Telegram foundation: authenticate as the user, read personal chats, groups, channels, and Saved Messages, backfill visible text history where feasible, persist text-oriented message data, and make that data visible in Postgres.

## Product Boundary

AgenTG is not a generic memory system for arbitrary private sources. It is not intended to become a WeChat, WhatsApp, email, bookmarks, or browser gateway.

The project is intentionally coupled to Telegram:

- Telegram user-client login.
- Telegram event stream.
- Telegram data model.
- Telegram API semantics.
- Telegram chats, messages, edits, deletes, reactions, media, threads, topics, and service events.

Without Telegram, this project should not have an independent product identity.

## Product Motivation

The strongest product pull is not duplicating Telegram notifications for direct messages. The user already has a normal Telegram client for immediate messaging. The first useful step is making Telegram text data reliably available outside the normal Telegram app.

## Core Principle

```text
First make Telegram data reliably available in Postgres.
```

The system should not invent higher-level assistant workflows before the Telegram client, historical sync, and live update persistence are working.

## Success Criteria

- The system logs in as the user and resumes the session.
- Chats, groups, channels, and Saved Messages are synchronized.
- Visible text history is backfilled where feasible.
- New text messages appear in Postgres shortly after they appear in the normal Telegram client.
- Attachment payloads are not bulk-downloaded by default, but attachment metadata is preserved.
- The stored data preserves Telegram identifiers and enough Telegram semantics for direct inspection and future code.
