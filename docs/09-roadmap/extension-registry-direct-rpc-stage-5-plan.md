# Extension Registry Direct RPC Stage 5 Plan

Stage 5 updates documentation, smoke checks, and source audits to match the new
extension architecture.

Parent plan:
[Extension Registry And Direct RPC Migration](extension-registry-direct-rpc-migration.md).

Previous stage:
[Extension Registry Direct RPC Stage 4 Plan](extension-registry-direct-rpc-stage-4-plan.md).

## Stage Goal

Make the repository describe and enforce the current extension architecture after
runtime migration is complete.

## Execution Rule

Before editing code for this stage, re-plan Stage 5 from the current repository
state and replace this file if the implementation details changed.

At the end of this stage, commit all changes with a conventional commit message.

## Concrete Scope

- Update architecture docs that mention `enriched`, envelope extensions, or
  domain-owned extension execution.
- Update operations docs and smoke scripts to check the separate registry and
  caller-side composition path.
- Update interface docs to describe direct RPC results, `_model` markers, and
  extension getter calls.
- Add or update source-audit checks to prevent reintroducing:
  - domain `enriched` behavior;
  - local domain extension registries;
  - registry-side RPC execution.
- Remove stale tests and helpers that exist only for old envelope extension
  behavior.

## Explicit Non-Scope

- Do not introduce a discovery service.
- Do not redesign Gateway or Control Plane public APIs beyond documenting their
  updated use of internal RPC.
- Do not add new extension products beyond the Summaries pilot path.

## Definition of Done

- Documentation matches direct RPC results, `_model` markers, separate registry,
  and caller-owned composition.
- Compose smoke no longer calls History or Telegram `listExtensions`.
- Source audit fails if runtime `enriched` extension execution returns.
- Full `npm run check` passes.

## Stop Rule

After Stage 5 is committed, stop. Any discovery service, routing registry, or
additional extension product needs a separate plan.
