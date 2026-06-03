# Views

- This folder owns read-only projections from stored Telegram database rows to
  procedure DTOs.
- Views may read database schemas, file read helpers, and model refs.
- Views must not write to storage, call TDLib operations, start processes, or
  publish events.
- Keep schemas next to view DTOs. Do not export procedure-specific DTO types
  for other modules.
