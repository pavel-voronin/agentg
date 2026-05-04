# Extension Registry Direct RPC Stage 4 Plan

Stage 4 removes domain-owned extension execution and adds caller-owned
composition.

Parent plan:
[Extension Registry And Direct RPC Migration](extension-registry-direct-rpc-migration.md).

Previous stage:
[Extension Registry Direct RPC Stage 3 Plan](extension-registry-direct-rpc-stage-3-plan.md).

## Stage Goal

Make domains extension-unaware and make callers responsible for building extended
views.

## Execution Rule

Before editing code for this stage, re-plan Stage 4 from the current repository
state and replace this file if the implementation details changed.

At the end of this stage, commit all changes with a conventional commit message.

## Concrete Scope

- Remove `enriched` builders, middleware, and tests.
- Remove local History and Telegram extension registry endpoints.
- Remove registered-extension execution helpers from shared and domain runtime
  code.
- Make Summaries register `summaries.chatSummary` against target `telegram.chat`
  in the new registry.
- Treat `summaries.chatSummary` as a getter RPC that receives the marked
  `telegram.chat` object.
- Add caller-side composition helpers:
  - call base RPC;
  - collect `_model` markers;
  - query registry by exact target;
  - call extension getter RPC methods through known service config;
  - assemble the extended view locally.

## Explicit Non-Scope

- Do not add service discovery to the registry.
- Do not add `kind` to registrations.
- Do not put extension results back into domain procedure outputs.
- Do not make domains call extension RPC methods.

## Definition of Done

- Runtime code no longer executes extensions from domain procedures.
- Summaries registration goes to the separate registry.
- A caller-side test or integration path composes a Telegram chat model with
  `summaries.chatSummary`.
- Package typecheck and tests pass for touched packages.

## Stop Rule

After Stage 4 is committed, stop. Stage 5 must be re-planned before docs, smoke,
and audit cleanup starts.
