# Failure Modes

## Missed Updates

Risk:

TDLib sidecar stops or loses connection.

Mitigation:

- health checks
- last update timestamp
- replay from TDLib/local state where possible

## Duplicate Inputs

Risk:

Retries deliver the same TDLib input more than once.

Mitigation:

- payload hash
- Telegram identifiers
- idempotent domain table writes

## Unauthorized Sending

Risk:

The client sends unintended Telegram messages.

Mitigation:

- audit log
- do not expose sending in the first product workflow
- keep low-level send commands explicit
