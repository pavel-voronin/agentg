# Telegram Domain

- This folder owns Telegram domain language.
- Domain files must not import TDLib, Drizzle, storage schema, Dashboard code,
  procedure DTOs, or runtime clients.
- Domain models are the only shared shapes for Telegram product data that
  crosses application services, repositories, procedures, events, and
  Dashboard payloads.
- Do not add compatibility aliases for replaced names.
