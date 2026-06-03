# History Sync Control Plane

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as
  `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one
  appears necessary, stop and report the boundary violation before editing code.

- This folder owns History Sync's Control Plane contribution for the current
  module.
- Keep browser-facing files under `frontend`.
- `controlPlane.ts` is the frontend contribution declaration consumed by
  Control Plane tooling. Export `controlPlane.contents` with dynamic `load()`
  imports.
- Do not register Control Plane-only procedures inside the runtime module.
- Do not put Telegram ingestion, TDLib code, database migrations, or generic
  framework code here.
