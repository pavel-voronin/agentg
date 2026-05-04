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

- Update current architecture docs that still describe `enriched`, envelope
  extensions, or domain-owned extension execution:
  - `docs/02-architecture/module-runtime-and-extensions.md`;
  - `docs/02-architecture/system-overview.md`;
  - `docs/02-architecture/component-boundaries.md`.
- Update current interface and operations docs:
  - `docs/05-interfaces/agent-gateway-api.md`;
  - `docs/06-operations/local-dev.md`;
  - `docs/06-operations/observability.md`;
  - ADR-0006 status/content if needed so it no longer reads as the current
    extension contract.
- Update `scripts/compose-smoke.mjs` to:
  - include the standalone `extension-registry` service;
  - poll `extension-registry.listExtensions({ target: 'telegram.chat' })`;
  - call `summaries.chatSummary` as a getter with a marked
    `{ _model: 'telegram.chat', id }` object;
  - assemble and print a caller-composed view in the smoke output.
- Add source-audit checks to prevent reintroducing:
  - domain `enriched` behavior;
  - local domain extension registries;
  - registry-side RPC execution.
- Leave old migration stage files as historical records; they may mention older
  intermediate states.

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
