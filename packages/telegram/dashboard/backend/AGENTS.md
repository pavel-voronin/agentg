# Dashboard Backend

- This folder owns Telegram Dashboard-only backend code.
- Procedures here serve Telegram Dashboard UI and must read Telegram data through
  domain procedures or repositories that return domain models.
- Procedures here are not public module procedures for other modules.
- Procedures here must not make Dashboard choose Telegram internals such as
  TDLib methods, raw history fetches, page cursors, coverage convergence, or file
  materialization strategy. If a Dashboard view needs Telegram data that is not
  locally readable, call or add a Telegram domain procedure that hides those
  mechanics.
- Accept resources explicitly from `createProcedures(resources)`.
- Do not use `useDatabase`, `useFiles`, `useTdlib`, or other singleton accessors.
- Keep frontend code and Vue components out of this folder.
