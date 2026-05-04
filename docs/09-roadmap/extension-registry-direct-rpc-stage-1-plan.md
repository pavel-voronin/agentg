# Extension Registry Direct RPC Stage 1 Plan

Stage 1 creates the separate extension registry service and shared helper
contracts only. It must not change domain RPC behavior.

Parent plan:
[Extension Registry And Direct RPC Migration](extension-registry-direct-rpc-migration.md).

## Stage Goal

Introduce a narrow `@agentg/extension-registry` package that can store and list
extension registrations independently from History, Telegram, Summaries, Gateway,
and Control Plane.

## Execution Rule

Before editing code for this stage, re-plan Stage 1 from the current repository
state and replace this file if the implementation details changed.

At the end of this stage, commit all changes with a conventional commit message.

## Concrete Scope

- Add the `packages/extension-registry` workspace and package scripts.
- Add registry config, service entrypoint, tRPC router/server, and tests.
- Implement in-memory TTL storage for `{ target, extension }`.
- Expose:
  - `registerExtension({ target, extension })`;
  - `listExtensions({ target })`;
  - `listExtensions()` for all active registrations.
- Add shared schemas for extension registration and model markers.
- Add `collectModelRefs(value)` to recursively return `{ _model, id }` pairs from
  JSON-shaped values.
- Update workspace and compose wiring only as needed to run the new service.

## Explicit Non-Scope

- Do not remove current History or Telegram local extension registries yet.
- Do not change `enriched` behavior yet.
- Do not change procedure envelopes yet.
- Do not add service discovery or extension RPC routing to the registry.
- Do not make Summaries register with the new registry yet.

## Definition of Done

- Registry tests cover register, refresh, exact-target list, all-list, and TTL
  cleanup.
- Registry code has no extension RPC caller, no service URL storage, and no
  routing table.
- Shared helper tests cover nested objects, arrays, duplicate refs, and invalid
  marker-shaped objects.
- Package typecheck and tests pass for touched packages.

## Stop Rule

After Stage 1 is committed, stop. Stage 2 must be re-planned before direct RPC
result migration starts.
