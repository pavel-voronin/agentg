# Failure Modes

## Missed Updates

Risk:

TDLib sidecar stops or loses connection.

Mitigation:

- health checks
- last update timestamp
- replay from TDLib/local state where possible

## Duplicate Events

Risk:

Retries produce duplicate raw events.

Mitigation:

- payload hash
- Telegram identifiers
- idempotent ingestion

## Unauthorized Sending

Risk:

The client sends unintended Telegram messages.

Mitigation:

- audit log
- do not expose sending in the first product workflow
- keep low-level send commands explicit
