# History Schema

This is the data shape for history sync. It records the domain model from
[History](../03-domains/history.md).

## Tables

```text
history_templates
history_targets
history_coverage
history_backfill_jobs
```

## history_templates

Templates describe desired history coverage for chats that are not represented
by one concrete target yet.

```text
id
match
range
created_at
updated_at
```

- `id`: stable template identifier.
- `match`: Telegram-shaped match criteria, stored as structured JSON.
- `range`: desired history range expression, stored as structured JSON.
- `created_at`, `updated_at`: storage timestamps.

`match` can describe criteria such as chat type, title, or other chat metadata.
The exact matcher grammar belongs to implementation, but the stored value should
remain structured and inspectable.

`range` stores two independent boundaries. A boundary is either an absolute time
or an expression that resolves to absolute time. Mixed ranges are valid:

```text
2025-01-01 -> 2026-01-01
now-30d -> now
2026-01-01 -> now
past -> now
```

Expressions can contain named literals. Boundary literals are stored as
literals, not as nulls. The initial literal set includes `past`; future literals
such as `install` may be added when the domain needs semantic cutoffs.

## history_targets

Targets describe desired history coverage for concrete chats.

```text
id
telegram_chat_id
template_id
range
created_at
updated_at
```

- `id`: target identifier.
- `telegram_chat_id`: concrete Telegram chat identifier.
- `template_id`: source template identifier when the target was materialized
  from a template.
- `range`: desired history range expression, stored as structured JSON.
- `created_at`, `updated_at`: storage timestamps.

When `template_id` is present, the target is linked to that template and follows
template updates. When `template_id` is absent, the target is standalone.

Directly created targets have no `template_id`. If a linked target is edited
directly, the template link is removed.

There can be more than one target for the same chat. A chat can have, for
example, one rolling recent target and one absolute historical target.

For one chat, targets with the same range describe the same desired coverage and
are coalesced rather than duplicated. Storage enforces uniqueness for
`telegram_chat_id + range`.

## history_coverage

Coverage is the painted timeline for concrete chats.

```text
id
telegram_chat_id
start_at
end_at
created_at
updated_at
```

- `id`: coverage interval identifier.
- `telegram_chat_id`: concrete Telegram chat identifier.
- `start_at`, `end_at`: covered time interval.
- `created_at`, `updated_at`: storage timestamps.

Coverage has no source field. Live updates and backfill jobs both write through
the same coverage operation.

Coverage rows are stored merged:

- intervals for the same chat do not overlap
- intervals for the same chat do not touch
- adding coverage merges matching existing intervals

## history_backfill_jobs

Backfill jobs describe executable historical fetch work.

```text
id
telegram_chat_id
start_at
end_at
status
cursor
created_at
updated_at
```

- `id`: job identifier.
- `telegram_chat_id`: concrete Telegram chat identifier.
- `start_at`, `end_at`: absolute interval to fetch.
- `status`: queue state, either `pending` or `running`.
- `cursor`: current paging position when a job has started.
- `created_at`, `updated_at`: storage timestamps.

Jobs are derived from targets minus coverage. They are not product policy.
Successfully finished jobs are deleted immediately after coverage is written;
`history_backfill_jobs` is a work queue, not a historical log.

Runnable jobs are ordered by missing intervals closest to the present first.
This ordering rule is not represented as a stored priority field.

Storage enforces uniqueness for `telegram_chat_id + start_at + end_at`.

## Derived Views

The useful inspection views are derived from the four tables:

- targets for a chat
- coverage for a chat
- missing intervals for a chat
- runnable jobs

The missing interval view is computed from target projection minus coverage.
