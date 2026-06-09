# Dashboard

- This folder owns Telegram's Dashboard contribution for the current
  module.
- Keep Dashboard backend and frontend separated by folder.
- `dashboard.ts` is the frontend contribution declaration consumed by Control
  Plane tooling. Export `dashboard.contents` as real slot content
  definitions with `load()` dynamic imports; do not rely on source-text parsing
  or asset manifest compatibility fields.
- Do not import backend procedures from `dashboard.ts`; the Vite virtual
  module imports this file into the browser graph.
- Backend code may import Telegram-owned storage, file, history, and view
  helpers. Frontend code must not import Node-only runtime, TDLib ingestion,
  file workers, database migrations, or process entrypoints.
- Do not register Dashboard-only procedures as public module procedures.
- Do not put TDLib ingestion, file workers, database migrations, or generic
  framework code here.
