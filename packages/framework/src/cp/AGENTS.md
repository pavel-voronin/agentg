# Control Plane Framework Surface

- This folder owns the generic Control Plane contribution API for module-owned
  Control Plane code: host access, slot contracts, slot runtime, manifest
  helpers, and shared UI primitives.
- Do not add module-specific screens, Telegram logic, History Sync logic,
  database schemas, or runtime module processes here.
- Public imports must use only `@agentg/framework/cp`. Do not add nested
  public entrypoints such as `/cp/slots`, `/cp/host`, or `/cp/ui`.
- Keep exports intentional. Export only values consumed by Control Plane shell
  code or module-owned Control Plane contributions.
