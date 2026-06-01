# Account Instructions

- This folder owns the current authenticated account identity resource for the Telegram module.
- Keep it small: it must not own TDLib client operations, status tracking, persistence, or update handling.
- Expose only the resource factory needed by module internals.
