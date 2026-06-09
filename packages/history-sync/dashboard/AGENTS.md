# History Sync Dashboard

- This folder owns History Sync's Dashboard contribution for the current
  module.
- Keep browser-facing files under `frontend`.
- `dashboard.ts` is the frontend contribution declaration consumed by
  Dashboard tooling. Export `dashboard.contents` with dynamic `load()`
  imports.
- Do not register Dashboard-only procedures inside the runtime module.
- Do not put Telegram ingestion, TDLib code, database migrations, or generic
  framework code here.
