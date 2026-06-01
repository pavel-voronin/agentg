# Telegram Database

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one appears necessary, stop and report the boundary violation before editing code.

- Do not hide material facts from the user. Explicitly disclose API changes,
  signature changes, compatibility paths, fallback behavior, architectural
  violations, failed checks, risky assumptions, and any workaround before or
  when presenting the change.
- This folder owns Telegram storage schema, typed database construction, and
  migration wiring for the current Telegram module.
- `storageSchema.ts` is generated from TDLib storage review data. Do not edit it
  manually; update `scripts/telegramDbSchemaGenerate.mjs` and regenerate.
- `schema.ts` is the module-owned aggregate Drizzle schema.
- `client.ts` owns the module database resource factory.
- Keep TDLib runtime clients, update handlers, stores, and read models out of
  this folder.
