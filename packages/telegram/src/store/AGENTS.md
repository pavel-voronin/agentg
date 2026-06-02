# Store

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one appears necessary, stop and report the boundary violation before editing code.

- This folder owns Telegram persistence functions.
- Store functions accept validated TDLib input types directly and translate them
  into Drizzle writes against `src/database/schema.ts`.
- Do not add `TelegramWire*` or other alias layers here. Use `tdlib-types`
  directly and use `src/tdlib/value.ts` only for scalar/date/json helpers.
- Do not import through `@agentg/telegram`; use owner-folder relative imports inside this package.
- Keep file names aligned with the storage area they write.
