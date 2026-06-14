# Dashboard Framework Surface

- This folder owns the generic Dashboard contribution API for module-owned
  Dashboard code: host access, slot contracts, slot runtime, manifest
  helpers, and shared UI primitives.
- Do not add module-specific screens, Telegram logic, database schemas, or
  runtime module processes here.
- Public imports must use only `@agentg/framework/dashboard`. Do not add nested
  public entrypoints such as `/dashboard/slots`, `/dashboard/host`, or `/dashboard/ui`.
- Keep exports intentional. Export only values consumed by Dashboard shell
  code or module-owned Dashboard contributions.
