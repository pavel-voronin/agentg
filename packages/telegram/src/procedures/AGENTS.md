# Procedures

- This folder owns the Telegram module public procedure handlers.
- A procedure file contains its input validation, output validation when useful,
  and the handler body for one public procedure.
- Procedure run functions take domain input first and resources second:
  `runSomething(input, resources)`.
- Procedures may call storage, views, history, files, and typed TDLib
  operations passed from `src/module.ts`.
- Procedures must not use raw TDLib clients, schedulers, invoke helpers, or
  construct TDLib function envelopes.
- Do not export procedure-specific Input or Output DTO types for other modules.
