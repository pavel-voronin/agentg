# Dashboard Backend

- This folder owns Telegram Dashboard-only backend code.
- Procedures here serve Telegram Dashboard UI and may read Telegram storage
  directly.
- Procedures here are not public module procedures for other modules.
- Accept resources explicitly from `createProcedures(resources)`.
- Do not use `useDatabase`, `useFiles`, `useTdlib`, or other singleton accessors.
- Keep frontend code and Vue components out of this folder.
