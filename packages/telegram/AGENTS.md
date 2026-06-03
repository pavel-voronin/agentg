# Telegram Package

- Do not hide material facts from the user. Explicitly disclose API changes,
  signature changes, compatibility paths, fallback behavior, architectural
  violations, failed checks, risky assumptions, and any workaround before or
  when presenting the change.
- This package is the current Telegram module built on `@agentg/framework`.
- Do not copy replaced implementation details without an explicit decision.
- Keep module setup readable from `src/module.ts`: resources, events, procedures,
  and processes must be visible there.
- Do not create helper files that hide domain ownership. If a helper is needed, first add an `AGENTS.md` to the target folder explaining its responsibility.
- Every new folder in this package must include its own `AGENTS.md` before code is added there.
- For local development, start this module from the repository root with `npm run dev:telegram`.
- Do not run `npm --workspace @agentg/telegram run dev` directly for local TDLib sessions: workspace execution resolves relative `TDLIB_DATABASE_DIR` and `TDLIB_FILES_DIR` under `packages/telegram`. The root script sources `.env`, sets local module registry/NATS defaults, and forces TDLib directories to `$PWD/td-data/database` and `$PWD/td-data/files`.
