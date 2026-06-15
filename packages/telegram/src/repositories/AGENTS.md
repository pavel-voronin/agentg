# Telegram Repositories

- This folder owns domain-facing repository ports and implementations.
- Repositories accept and return Telegram domain models or domain records.
- Repositories may call storage implementations, but must not expose Drizzle
  rows, `$inferInsert`, `$inferSelect`, SQL, TDLib payloads, or Dashboard
  details to callers.
- Do not export repository types through the package root unless a current
  external package consumer needs them.
