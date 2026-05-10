# History Sync Schema

History Sync stores desired sync policy. Telegram stores Telegram facts and
Telegram history coverage.

## Tables

```text
history_sync_templates
history_sync_targets
```

## history_sync_templates

Templates describe desired Telegram history for chats that are not represented
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

`range` stores two independent boundaries. A boundary is either an absolute time
or an expression that resolves to absolute time:

```text
2025-01-01 -> 2026-01-01
now-30d -> now
2026-01-01 -> now
past -> now
```

## history_sync_targets

Targets describe desired Telegram history for concrete chats.

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

For one chat, targets with the same range describe the same desired coverage and
are coalesced rather than duplicated. Storage enforces uniqueness for
`telegram_chat_id + range`.

## Related Telegram Tables

Telegram owns:

- `telegram_history_coverage`
- `telegram_history_coverage_proofs`

History Sync reads Telegram coverage through Telegram RPC when it needs an
operator read model. It does not write these tables.
