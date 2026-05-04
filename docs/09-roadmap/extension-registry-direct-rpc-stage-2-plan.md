# Extension Registry Direct RPC Stage 2 Plan

Stage 2 converts domain RPC return contracts to direct result bodies and adds
inline model markers.

Parent plan:
[Extension Registry And Direct RPC Migration](extension-registry-direct-rpc-migration.md).

Previous stage:
[Extension Registry Direct RPC Stage 1 Plan](extension-registry-direct-rpc-stage-1-plan.md).

## Stage Goal

Remove the standard internal RPC envelope from domain procedure outputs and make
model identity visible directly on returned model objects.

## Execution Rule

Before editing code for this stage, re-plan Stage 2 from the current repository
state and replace this file if the implementation details changed.

At the end of this stage, commit all changes with a conventional commit message.

## Concrete Scope

- Replace procedure outputs shaped as `{ ok, result, extensions }` with direct
  result bodies in History, Telegram, and Summaries internal RPC.
- Update clients and tests that unwrap procedure envelopes.
- Add `_model: 'telegram.chat'` to chat DTOs that represent stable Telegram chat
  models and already expose `id`.
- Keep domain fields such as `type: 'supergroup'` unchanged.
- Convert generic domain error envelopes to tRPC errors.
- Stop relying on `enriched` for converted procedures because direct result
  bodies have no extension envelope to fill.

## Explicit Non-Scope

- Do not delete the old `enriched` helper implementation in this stage; Stage 4
  owns full cleanup of unused extension execution code.
- Do not move Summaries registration to the new registry yet.
- Do not introduce envelope `meta`, nested `modelRef`, or registration `kind`.
- Do not redesign Gateway or Control Plane public protocols beyond adapting to
  direct internal RPC results.

## Definition of Done

- History, Telegram, and Summaries RPC tests assert direct results.
- Internal clients no longer call `unwrapProcedureEnvelope` for converted
  procedures.
- Chat model DTOs include `_model: 'telegram.chat'` and `id`.
- Package typecheck and tests pass for touched packages.

## Stop Rule

After Stage 2 is committed, stop. Stage 3 must be re-planned before lifecycle
call option changes start.
