# Telegram Database Migrations

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one appears necessary, stop and report the boundary violation before editing code.

- Do not hide material facts from the user. Explicitly disclose API changes,
  signature changes, compatibility paths, fallback behavior, architectural
  violations, failed checks, risky assumptions, and any workaround before or
  when presenting the change.
- This folder contains Drizzle SQL migrations for the current Telegram
  module.
- `0000_telegram_tdlib_schema.sql` is generated from TDLib storage review data.
- Other migrations must match `src/database/schema.ts`.
- Do not put runtime code here.
