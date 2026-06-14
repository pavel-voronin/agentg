# Backlog

## Architecture

- Decide codebase layout.
- Validate TypeScript/Node.js as the first TDLib sidecar runtime.
- Revisit the TDLib sidecar runtime if Node.js integration becomes operationally weak.
- Decide local development stack.
- Define Telegram Client Core boundary in code.
- Decide how closely internal schemas should track TDLib objects versus stable internal Telegram-shaped records.
- Decide the smallest console workflow that proves authentication, chat discovery, and message persistence.

## Data

- Draft SQL schema for TDLib domain tables.
- Draft SQL schema for messages.
- Draft SQL schema for chats.
- Draft SQL schema for users or sender records.
- Draft SQL schema for Telegram history coverage intervals.
- Draft SQL schemas for participants, files, reactions, and topics.
- Decide retention defaults.

## Telegram Client

- Define MVP Telegram API subset.
- Define how personal chats, groups, and channels are discovered and synchronized.
- Define how replies and forwarded messages are represented in the first schema.
- Define long-term Telegram API coverage strategy.
- Define how service events, media, topics, and reactions are normalized after text-message ingestion works.

## Operations

- Define secret storage.
- Define backup and restore process.
- Define health checks.
