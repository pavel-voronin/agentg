# Ingestion

## Responsibility

Ingestion receives Telegram updates and historical fetch results from the TDLib sidecar and preserves them as durable raw events.

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
- Historical fetch results and live updates should both be able to paint history coverage.
- New Telegram messages should become visible in Postgres shortly after they appear in the user's normal Telegram client.
- Historical sync should follow concrete chat targets managed by the history sync domain.
- Attachment payloads should not be required for initial bulk ingestion; attachment metadata is enough until a later pipeline requests the payload.

## Open Questions

- Should raw TDLib payloads be stored exactly or reduced to a stable internal event envelope?
- What is the first retention policy for raw events?
- Should media payloads be downloaded, skipped, or stored as metadata only in the first implementation?
