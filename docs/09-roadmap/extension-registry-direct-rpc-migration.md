# Extension Registry And Direct RPC Migration

This plan migrates AgenTG from `enriched` RPC responses and extension-filled
procedure envelopes to direct domain RPC results and caller-owned composition.

The plan is intentionally staged. Do not start a stage until the previous stage
meets its Definition of Done. Re-plan each stage immediately before
implementation; the stage files below define boundaries and acceptance criteria,
not a frozen task list.

Every stage must end with a conventional commit that includes all changes made in
that stage.

## Target State

- Domains return direct procedure results, not `{ ok, result, extensions }`
  envelopes.
- Domains do not know who extends their models or procedures.
- There is no `enriched` RPC builder or behavior.
- `observable` is only a call option, not a procedure builder.
- Extension registry is a separate narrow service that stores and lists
  `{ target, extension }` registrations.
- Extension registry does not call extension RPC methods and does not own service
  discovery.
- Model objects mark themselves with `_model` and their existing `id`.
- Caller code composes extended views by calling a base procedure, collecting
  model markers, reading extension registrations, calling extension getter RPC
  methods through known service config, and assembling the view locally.

## Stage 1: Registry Service And Shared Contracts

Purpose: create the separate extension registry boundary and the shared helper
contracts it needs without changing current domain behavior.

Stage re-plan:
[Extension Registry Direct RPC Stage 1 Plan](extension-registry-direct-rpc-stage-1-plan.md).

Scope:

- Add the `@agentg/extension-registry` workspace package.
- Add an in-memory TTL registry for `{ target, extension }`.
- Expose register/list tRPC procedures for registrations.
- Add shared schemas/helpers for extension registration and `_model` collection.
- Keep current History, Telegram, Summaries, Gateway, and Control Plane runtime
  behavior unchanged.

Definition of Done:

- Registry can register, refresh, list, and expire registrations by exact target.
- Registry has no extension RPC caller code.
- Shared helper can collect `{ _model, id }` markers from nested JSON-shaped data.
- Existing checks pass for touched packages.
- All Stage 1 changes are committed before Stage 2 starts.

Stage 1 must be re-planned before implementation.

## Stage 2: Direct Domain RPC Results And Model Markers

Purpose: remove procedure envelopes from domain RPC results and mark returned
models inline.

Stage re-plan:
[Extension Registry Direct RPC Stage 2 Plan](extension-registry-direct-rpc-stage-2-plan.md).

Scope:

- Convert internal domain procedures from standard envelopes to direct result
  bodies.
- Add `_model: 'telegram.chat'` to returned Telegram chat model objects that have
  stable `id` values.
- Remove extension data from domain response contracts.
- Move domain errors to tRPC error flow unless a procedure explicitly models an
  error as data.

Definition of Done:

- History, Telegram, and Summaries RPC tests expect direct result bodies.
- Chat DTOs representing Telegram chats include `_model: 'telegram.chat'`.
- No internal RPC contract requires `{ ok, result, extensions }`.
- Existing checks pass for touched packages.
- All Stage 2 changes are committed before Stage 3 starts.

Stage 2 must be re-planned before implementation.

## Stage 3: Lifecycle Events And Call Options

Purpose: make lifecycle events default RPC behavior and add exact current-call
controls for lifecycle and synchronous fact events.

Stage re-plan:
[Extension Registry Direct RPC Stage 3 Plan](extension-registry-direct-rpc-stage-3-plan.md).

Scope:

- Publish RPC lifecycle events by default for internal procedures.
- Remove `observable` as a builder concept.
- Add call options for `observable?: boolean` and `silent?: boolean`.
- Ensure `observable: false` suppresses only lifecycle events for the current RPC
  call.
- Ensure `silent: true` suppresses lifecycle events and synchronously published
  fact events for the current RPC handler only.

Definition of Done:

- Lifecycle tests cover default publishing, `observable: false`, and
  `silent: true`.
- No procedure uses an `observable` builder.
- Asynchronous work started by a procedure is not silenced after the procedure
  returns.
- Existing checks pass for touched packages.
- All Stage 3 changes are committed before Stage 4 starts.

Stage 3 must be re-planned before implementation.

## Stage 4: Remove Enriched Execution And Add Caller Composition

Purpose: delete domain-owned extension execution and move extension composition
to callers.

Stage re-plan:
[Extension Registry Direct RPC Stage 4 Plan](extension-registry-direct-rpc-stage-4-plan.md).

Scope:

- Remove `enriched` builders, middleware, local domain extension registries, and
  registered-extension execution helpers.
- Register Summaries extensions against the new registry.
- Treat model extensions as getter RPC methods; for example,
  `summaries.chatSummary` receives the marked model object for `telegram.chat`.
- Add caller-side composition helpers that call base RPC, collect `_model`
  markers, query the registry, call extension getter RPC methods through known
  service config, and assemble the extended view.

Definition of Done:

- Domain services never call extension RPC methods while serving base domain
  procedures.
- Summaries registers `summaries.chatSummary` against `telegram.chat`.
- A caller-side integration path can compose a base chat view with the Summaries
  chat summary getter.
- Existing checks pass for touched packages.
- All Stage 4 changes are committed before Stage 5 starts.

Stage 4 must be re-planned before implementation.

## Stage 5: Documentation, Smoke, And Boundary Cleanup

Purpose: make the new architecture the documented current behavior and remove
stale old-extension expectations.

Stage re-plan:
[Extension Registry Direct RPC Stage 5 Plan](extension-registry-direct-rpc-stage-5-plan.md).

Scope:

- Update architecture, interface, operations, and roadmap docs that still describe
  `enriched`, envelope extensions, or domain-owned extension execution.
- Update compose smoke checks to validate registry registration and caller-side
  composition.
- Add or update source audit checks for the new boundaries.
- Remove dead code and tests that only support old extension envelope behavior.

Definition of Done:

- Docs describe direct RPC results, `_model` markers, separate registry, and
  caller-owned composition.
- Smoke checks no longer expect History or Telegram to expose local extension
  registries.
- Source audit prevents reintroducing `enriched` as a domain behavior.
- Full repository check passes.
- All Stage 5 changes are committed.

Stage 5 must be re-planned before implementation.

## Global Non-Scope

- No service discovery layer in this migration. Callers use existing service URL
  config/env for extension RPC routing.
- No envelope `meta` for model references.
- No nested `modelRef` object.
- No `kind` field in extension registration.
- No attempt to silence asynchronous work after an RPC handler returns.

## Global Acceptance

- `rg -n "enriched" packages/events/src packages/rpc/src packages/infra/src packages/history/src packages/telegram/src`
  returns no runtime extension behavior.
- `rg -n "observable =" packages` does not find an exported builder used by
  procedures.
- Internal RPC procedures return domain-shaped values directly.
- Registry stores only registrations and never invokes RPC.
- Every stage has a stage-specific re-plan and a conventional commit.
