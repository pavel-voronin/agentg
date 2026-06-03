# Store

- This folder owns Telegram persistence functions.
- Store functions accept validated TDLib input types directly and translate them
  into Drizzle writes against `src/database/schema.ts`.
- Do not add `TelegramWire*` or other alias layers here. Use `tdlib-types`
  directly and use `src/tdlib/value.ts` only for scalar/date/json helpers.
- Do not import through `@agentg/telegram`; use owner-folder relative imports inside this package.
- Keep file names aligned with the storage area they write.
