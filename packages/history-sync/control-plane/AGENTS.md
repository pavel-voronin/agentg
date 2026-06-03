# History Sync Control Plane

- This folder owns History Sync's Control Plane contribution for the current
  module.
- Keep browser-facing files under `frontend`.
- `controlPlane.ts` is the frontend contribution declaration consumed by
  Control Plane tooling. Export `controlPlane.contents` with dynamic `load()`
  imports.
- Do not register Control Plane-only procedures inside the runtime module.
- Do not put Telegram ingestion, TDLib code, database migrations, or generic
  framework code here.
