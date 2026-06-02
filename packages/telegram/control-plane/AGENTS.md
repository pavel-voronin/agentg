# Control Plane

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one appears necessary, stop and report the boundary violation before editing code.

- This folder owns Telegram's Control Plane contribution for the current
  module.
- Keep Control Plane backend and frontend separated by folder.
- `controlPlane.ts` is the frontend contribution declaration consumed by Control
  Plane tooling. Export `controlPlane.contents` as real slot content
  definitions with `load()` dynamic imports; do not rely on source-text parsing
  or asset manifest compatibility fields.
- Do not import backend procedures from `controlPlane.ts`; the Vite virtual
  module imports this file into the browser graph.
- Backend code may import Telegram-owned storage, file, history, and view
  helpers. Frontend code must not import Node-only runtime, TDLib ingestion,
  file workers, database migrations, or process entrypoints.
- Do not register Control Plane-only procedures as public module procedures.
- Do not put TDLib ingestion, file workers, database migrations, or generic
  framework code here.
