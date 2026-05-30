# Registry Source

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one appears necessary, stop and report the boundary violation before editing code.

- Do not hide material facts from the user. Explicitly disclose API changes,
  signature changes, compatibility paths, fallback behavior, architectural
  violations, failed checks, risky assumptions, and any workaround before or
  when presenting the change.
- `config.ts` loads process configuration for this deployable runner.
- `main.ts` is only the local process entrypoint: create the framework Registry module app, start it, and attach shutdown handling.
- `main.ts` may pass already-loaded module or framework config into framework APIs.
- `main.ts` must not parse env, normalize transport options, construct clients, wire registries, contain business logic, or include test/debug scaffolding inline. Put reusable setup behind named framework/module APIs before using it here.
- Do not add Registry contracts, registry, clients, procedure handlers,
  or snapshot helpers here. They belong to `@agentg/framework`.
