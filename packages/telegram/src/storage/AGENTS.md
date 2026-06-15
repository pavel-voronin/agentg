# Telegram Storage

- This folder owns Drizzle-backed persistence implementations for Telegram
  domain models and domain records.
- Storage code may import Drizzle, database schema, SQL helpers, and migrations.
- Storage code must not import TDLib types, TDLib clients, Dashboard code, or
  procedure DTOs.
- Storage functions accept domain models or domain records and return direct
  persistence results only.
