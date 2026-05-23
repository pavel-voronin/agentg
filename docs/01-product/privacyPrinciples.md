# Privacy Principles

Telegram integration uses the user's own account and must be treated as credential-bearing infrastructure.

## Principles

- Store credentials and sessions securely.
- Keep ingestion read-only by default.
- Require human approval before sending messages.
- Keep write-like Telegram actions explicit and auditable.
- Treat stored Telegram history as sensitive personal data.
- Keep deletion, retention, and export policies explicit.

## Sensitive Boundary

The TDLib sidecar owns the Telegram session. Components outside the sidecar should not need raw Telegram credentials.

## Default Sending Policy

```text
direct send: disabled
low-level sendMessage wrapper: allowed if useful for client validation
external automated sending: not part of the first implementation
```
