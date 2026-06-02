# Telegram Source

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one appears necessary, stop and report the boundary violation before editing code.

- Do not hide material facts from the user. Explicitly disclose API changes,
  signature changes, compatibility paths, fallback behavior, architectural
  violations, failed checks, risky assumptions, and any workaround before or
  when presenting the change.
- `module.ts` declares the module composition.
- `config.ts` loads process configuration and turns framework transport config into ready startup values.
- `main.ts` is only the local process entrypoint: create the module app, start it, and attach shutdown handling.
- `main.ts` may pass already-loaded module or framework config into framework APIs.
- `main.ts` must not parse env, normalize transport options, construct clients, perform domain wiring, contain business logic, or include test/debug scaffolding inline. Put reusable setup behind named framework/module APIs before using it here.
- Do not add TDLib ingestion, database, or file folders until their responsibilities
  are named in local `AGENTS.md` files.
- Do not use compatibility code from the replaced Telegram implementation.
