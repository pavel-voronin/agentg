# ADR-0001: Use TDLib User Client

## Status

Accepted for initial design.

## Context

The system needs access to the user's own Telegram account as a personal information source.

Telegram Bot API is designed for bots and does not behave as a full personal Telegram client. Bots may be limited in groups and do not represent the user's own client session.

TDLib is a Telegram client library that handles networking, encryption, local storage, and update consistency.

## Decision

Use a TDLib-based user-client sidecar for Telegram ingestion.

## Consequences

Positive:

- can act as the user's Telegram client
- avoids hand-written MTProto complexity
- handles much of Telegram client state

Negative:

- stores sensitive session data
- requires stronger security boundaries
- more operationally sensitive than a bot

