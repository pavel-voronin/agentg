# Control Plane Backend

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one appears necessary, stop and report the boundary violation before editing code.

- This folder owns Telegram Control Plane-only backend code.
- Procedures here serve Telegram Control Plane UI and may read Telegram storage
  directly.
- Procedures here are not public module procedures for other modules.
- Accept resources explicitly from `procedures(resources)`.
- Do not use `useDatabase`, `useFiles`, `useTdlib`, or other singleton accessors.
- Keep frontend code and Vue components out of this folder.
