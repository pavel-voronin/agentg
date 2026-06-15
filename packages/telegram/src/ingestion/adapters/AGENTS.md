# Ingestion Adapters

- This folder is the TDLib parsing boundary for ingestion.
- Files here may import `tdlib-types` and `tdlib/shape`.
- Adapter output must be Telegram domain models or narrowly scoped domain event
  payload fragments.
- Do not import Drizzle, storage schema, repositories, Dashboard code, or
  procedure implementations.
