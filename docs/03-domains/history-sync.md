# History Sync

History Sync defines which Telegram history the product wants to have locally
and when to ask Telegram to converge toward that desired state.

The domain owns two durable policy objects:

```text
HistorySyncTemplate -> HistorySyncTarget
```

Telegram owns Telegram facts, message persistence, TDLib paging state, and
Telegram history coverage.

## HistorySyncTemplate

`HistorySyncTemplate` is an abstract declaration for chats that are not represented
by one concrete target yet.

A template can describe future or newly discovered chats by Telegram-shaped
criteria such as chat type or title. It contains the desired history range that
should become a concrete target when a matching chat appears.

Templates are not executed directly. They materialize concrete `HistorySyncTarget`
objects for concrete chats.

## HistorySyncTarget

`HistorySyncTarget` is desired Telegram history coverage for one concrete chat.

Every target has a `chatId`. A target can be created directly for a known chat
or materialized from a template.

If a target has a `templateId`, it is linked to that template. If the template
is updated, linked targets update with it. If a specific target is edited
directly, the template link is removed and the target becomes standalone.

A target range has two independent boundaries. Each boundary is either an
absolute time or an expression that resolves to absolute time:

```text
[2025-01-01, 2026-01-01]
[now-30d, now]
[2026-01-01, now]
[past, now]
```

## Sync Loop

History Sync performs a desired-state loop:

1. Ask Telegram for listable history chats.
2. Materialize templates into concrete targets.
3. Project target ranges to absolute intervals.
4. Ask Telegram to ensure coverage for a bounded absolute interval.

History Sync does not inspect Telegram coverage to derive missing pages. Telegram
computes missing intervals from Telegram-owned coverage and owns TDLib cursor
state for page continuity.

## Boundary

History Sync owns:

- template grammar and materialization
- concrete target writes
- sync cadence and wake-up policy
- projection of target expressions into absolute requested intervals

History Sync does not own:

- Telegram messages, chats, users, files, or TDLib state
- Telegram history coverage tables
- TDLib page cursors
- Telegram coverage convergence decisions

## Invariants

- Templates materialize targets; templates are not executed directly.
- Targets are product desired state for one Telegram chat.
- Telegram history coverage changes only as a byproduct of Telegram fetching or
  receiving messages.
- History Sync asks Telegram for absolute intervals and does not mutate coverage
  directly.
