# Ingestion

## Responsibility

Ingestion receives Telegram updates and historical fetch results from the TDLib
sidecar and immediately writes them through TDLib update handlers into durable
Telegram domain tables.

## Inputs

- TDLib updates.
- Historical message fetch results.
- Telegram chat identifiers.
- Telegram message identifiers.
- Update timestamps and local ingestion timestamps.

## Outputs

- Idempotent domain table writes.
- Malformed or unhandled TDLib update diagnostics.
- Idempotency metadata.

## Invariants

- Successful TDLib inputs are not stored as a durable raw event log.
- Malformed or unhandled TDLib updates are diagnostics, not a product data
  source.
- Ingestion should preserve enough normalized data to answer Telegram-domain
  reads without replaying TDLib payloads.
- Historical fetch results and live updates should both be able to paint history coverage.
- New Telegram messages should become visible in Postgres shortly after they appear in the user's normal Telegram client.
- Historical materialization should follow Telegram-owned read and coverage
  rules.
- Attachment payloads should not be required for initial bulk ingestion; attachment metadata is enough until a later pipeline requests the payload.

## Open Questions

- Should media payloads be downloaded, skipped, or stored as metadata only in the first implementation?
