# Ingestion

## Responsibility

Ingestion receives Telegram updates and historical backfill results from the TDLib sidecar and preserves them as durable raw events.

## Inputs

- TDLib updates.
- Historical message fetch results.
- Telegram chat identifiers.
- Telegram message identifiers.
- Update timestamps and local ingestion timestamps.

## Outputs

- Append-only raw event records.
- Idempotency metadata.
- Normalization queue items.

## Invariants

- Raw events are never treated as direct agent input.
- Raw event storage is append-only.
- Ingestion should be replayable.
- Ingestion should preserve enough metadata to rebuild normalized state.
- Historical backfill progress should be tracked per chat so sync can resume safely.
- New Telegram messages should become visible in Postgres shortly after they appear in the user's normal Telegram client.
- Historical sync should aim to cover all text content visible to the user's normal Telegram client.
- Attachment payloads should not be required for initial bulk ingestion; attachment metadata is enough until a later pipeline requests the payload.

## Open Questions

- Should raw TDLib payloads be stored exactly or reduced to a stable internal event envelope?
- What is the first retention policy for raw events?
- Should media payloads be downloaded, skipped, or stored as metadata only in the first implementation?
- What default backfill limits should apply to private chats, groups, and channels?
