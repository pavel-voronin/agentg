# History Sync

History sync defines how AgenTG decides which Telegram history should exist
locally and how the system converges toward that desired state.

The domain is split into four objects:

```text
HistoryTemplate -> HistoryTarget -> HistoryCoverage -> BackfillJob
                         ^                 |
                         |                 v
                    HistoryReconciler <-----
```

## HistoryTemplate

`HistoryTemplate` is an abstract declaration for chats that are not represented
by one concrete target yet.

A template can describe future or newly discovered chats by Telegram-shaped
criteria such as chat type, title, or other metadata. It contains the desired
history range that should become a concrete target when a matching chat appears.

Examples:

- for new private chats, cover the last 30 days
- for new channels matching a condition, cover the last 7 days

Templates are not executed directly. They materialize concrete
`HistoryTarget` objects for concrete chats.

If there are no templates and no concrete targets, history backfill is disabled:
the reconciler has no desired coverage to pursue.

## HistoryTarget

`HistoryTarget` is the desired history coverage for one concrete chat.

Every target has a `chatId`. A target can be created directly for a known chat
or materialized from a template.

If a target has a `templateId`, it is linked to that template. If the template
is updated, linked targets update with it. If a specific target is edited
directly, the template link is removed and the target becomes standalone.

A target range has two independent boundaries. Each boundary is either an
absolute time or an expression that resolves to absolute time. This allows mixed
ranges:

```text
[2025-01-01, 2026-01-01]
[now-30d, now]
[2026-01-01, now]
[past, now]
```

Expressions can contain named literals. Boundary literals are stored as
literals. The initial literal set includes `past`; future literals such as
`install` may be added when the domain needs semantic cutoffs.

## HistoryCoverage

`HistoryCoverage` is the painted timeline for one chat.

It stores only facts:

```text
chatId
startAt
endAt
```

Coverage has no source or provenance field. Live updates and backfill jobs paint
the same timeline. If two coverage intervals overlap or touch, they merge into
one interval.

A coverage interval means the system has covered that time range for the chat:
messages in the interval have been persisted, or the system has observed that no
messages exist there.

Coverage is stored as a merged set of intervals:

- intervals for the same chat do not overlap
- intervals for the same chat do not touch
- every interval has `startAt < endAt`

Until retention or deletion is introduced, coverage only grows.

## BackfillJob

`BackfillJob` is execution state for one absolute missing interval.

Jobs are derived from targets and coverage. They are not product policy.

A job represents:

```text
chatId
absolute interval to fetch
current paging position, if already started
```

The executor runs jobs, fetches Telegram history, persists messages, and extends
coverage for the interval it covered.

Completed jobs are not retained as queue rows. Once a job successfully extends
coverage, it is deleted from `history_backfill_jobs`; durable completion history belongs
to events/logs, not to the work queue.

## HistoryReconciler

`HistoryReconciler` compares desired coverage with actual coverage and derives
backfill jobs.

For a target, it computes:

```text
desired = project target range to absolute time
missing = desired - coverage(chatId)
jobs = split missing into executable intervals
```

The reconciler does not call TDLib and does not fetch messages. It only turns
missing coverage into jobs.

Relative targets need to be projected again as time moves. Absolute targets
project to the same interval every time.

When several jobs are runnable, execution starts with missing intervals closest
to the present. This is a reconciler rule, not a stored priority field.

## Template Materialization

Templates are evaluated by a materializer, not by the reconciler.

When a chat is discovered or its relevant metadata changes, matching templates
can materialize or update linked targets for that chat.

When a template changes, targets still linked to that template update with it.
Standalone targets are left alone.

## Interval Algebra

History sync depends on explicit interval operations:

- `merge`: add a covered interval and merge overlaps or touching intervals
- `project`: convert a target range into absolute time
- `subtract`: compute missing intervals from desired coverage minus coverage
- `split`: break missing intervals into executable job windows

Example:

```text
target:
[Jan 01 -------------------------------- Jan 31]

coverage:
[Jan 01 ---- Jan 05] [Jan 10 ---- Jan 12] [Jan 20 ---- Jan 31]

missing:
          [Jan 05 ---- Jan 10] [Jan 12 ---- Jan 20]
```

## Live Updates

Live Telegram updates paint ordinary `HistoryCoverage`.

A live update extends coverage when ingestion accepts it as part of the message
history for a concrete chat. Updates about authorization, connection state,
presence, or other non-message state do not paint history coverage.

There is no separate live coverage entity. Ingestion can extend the currently
covered tail for each known chat instead of creating one interval per accepted
message-history update. Backfill jobs use the same coverage writer, so a tail
covered by live updates and an older interval covered by backfill merge when
they meet.

For a target such as `[now-30d, now]`, jobs only fill the historical gap between
older coverage and the live-covered tail. Once the gap is closed, the moving
`now` boundary can be satisfied by the live stream without constant backfill
work.

## Invariants

- Templates materialize targets; they are not executed directly.
- Targets are concrete desired state for one chat.
- Coverage is the only fact used to decide what history is already covered.
- Coverage has no source field.
- Backfill jobs are derived from target minus coverage.
- The executor writes messages and coverage.
- The reconciler writes jobs.
- Retention and deletion are separate future concerns.
