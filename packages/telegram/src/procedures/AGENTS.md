# Procedures

- This folder owns the Telegram module public procedure handlers.
- A procedure file contains its input validation, output validation when useful,
  and the handler body for one public procedure.
- Procedure run functions take domain input first and resources second:
  `runSomething(input, resources)`.
- Public procedures must be Telegram domain capabilities. Do not expose raw
  TDLib operations, page fetches, TDLib cursors, coverage internals, file
  reconciliation controls, worker controls, or materialization strategy switches
  as module procedures.
- Procedures may call storage, views, history, files, and typed TDLib operations
  passed from `src/module.ts`, but those calls are private implementation
  details hidden behind the domain procedure contract.
- Procedures must not use raw TDLib clients, schedulers, invoke helpers, or
  construct TDLib function envelopes.
- If another domain needs data or behavior that currently requires a lower-level
  helper, add a domain-level Telegram procedure instead of exporting the helper.
- Do not export procedure-specific Input or Output DTO types for other modules.
