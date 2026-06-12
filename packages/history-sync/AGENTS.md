# History Sync Package

- This package is the current History Sync module built on
  `@agentg/framework`.
- This module must not import TDLib clients or Telegram storage schema. It talks
  to Telegram through Telegram domain procedures only.
- History Sync must not choose Telegram lower-level behavior such as TDLib
  methods, page fetches, cursors, coverage storage operations, or file
  materialization strategy. It owns desired history policy; Telegram owns how
  that policy converges into Telegram storage.
- Keep module setup readable from `src/module.ts`: resources, procedures, and
  background processes must be visible there.
- Every new folder in this package must include its own `AGENTS.md` before code
  is added there.
