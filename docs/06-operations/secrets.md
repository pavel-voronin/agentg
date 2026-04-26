# Secrets

Telegram user-client integration is sensitive because it can access the user's account.

## Secret Classes

- Telegram API credentials.
- TDLib session data.
- Database credentials.

## Principles

- Never expose Telegram credentials outside the sidecar boundary.
- Prefer local encrypted storage where practical.
- Document manual recovery and revocation steps.

## Open Questions

- How should TDLib database encryption be configured?
- Where should local development secrets live?
- What is the emergency kill switch?
