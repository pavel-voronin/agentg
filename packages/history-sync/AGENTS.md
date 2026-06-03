# History Sync Package

- This package is the current History Sync module built on
  `@agentg/framework`.
- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as
  `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one
  appears necessary, stop and report the boundary violation before editing code.
- This module must not import TDLib clients or Telegram storage schema. It talks
  to Telegram through public module procedures only.
- Keep module setup readable from `src/module.ts`: resources, procedures, and
  background processes must be visible there.
- Every new folder in this package must include its own `AGENTS.md` before code
  is added there.
