# Framework Events Source

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one appears necessary, stop and report the boundary violation before editing code.

- Do not hide material facts from the user. Explicitly disclose API changes,
  signature changes, compatibility paths, fallback behavior, architectural
  violations, failed checks, risky assumptions, and any workaround before or
  when presenting the change.
- `eventBus.ts` defines the framework event bus contract only.
- `nats.ts` implements NATS-backed event bus factories. `nats(url)` is shorthand
  for `nats({ servers: url })`.
- `nats()` must require an explicit connection target. Do not add framework or
  library default server behavior.
- Do not add event registration, event validation, manifest event surfaces, or publish guards here.
- Do not leak NATS-specific setup into the generic event bus contract.
- Keep alternate event bus implementations behind the same `EventBusFactory` contract.
