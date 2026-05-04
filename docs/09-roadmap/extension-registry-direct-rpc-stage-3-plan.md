# Extension Registry Direct RPC Stage 3 Plan

Stage 3 makes RPC lifecycle events the default and restricts `observable` to a
call option.

Parent plan:
[Extension Registry And Direct RPC Migration](extension-registry-direct-rpc-migration.md).

Previous stage:
[Extension Registry Direct RPC Stage 2 Plan](extension-registry-direct-rpc-stage-2-plan.md).

## Stage Goal

Provide exact per-call event controls while keeping domain fact events separate
from RPC lifecycle observability.

## Execution Rule

Before editing code for this stage, re-plan Stage 3 from the current repository
state and replace this file if the implementation details changed.

At the end of this stage, commit all changes with a conventional commit message.

## Concrete Scope

- Add a shared internal RPC call options helper:
  - `observable?: boolean`;
  - `silent?: boolean`;
  - HTTP header serialization for tRPC operation context;
  - per-request header parsing that keeps options attached to the matching
    operation path.
- Publish `started`, `progress`, `completed`, and `failed` lifecycle events by
  default from the base History, Telegram, and Summaries `rpc` procedure.
- Remove `observable` as an exported procedure builder and convert current
  `observable` procedure uses to `rpc`.
- Pass call options outside domain input through tRPC operation context and
  generated HTTP headers in internal clients.
- Make `observable: false` suppress only lifecycle events for the current RPC
  call.
- Make `silent: true` suppress lifecycle events and synchronously published fact
  events for the current RPC handler only.
- Keep `enriched` as a compatibility builder for Stage 4 cleanup, but make it
  build on the same base `rpc` procedure rather than on a separate observable
  branch.

## Explicit Non-Scope

- Do not silence asynchronous work after the RPC handler returns.
- Do not add durable event storage.
- Do not add cancellation semantics.
- Do not alter event subject names except where direct RPC result conversion
  requires test fixture updates.
- Do not add lifecycle publishing to the standalone Extension Registry service
  in this stage; it has no event bus dependency today.

## Definition of Done

- Tests cover default lifecycle publishing.
- Tests cover `observable: false` preserving synchronous fact events.
- Tests cover `silent: true` suppressing lifecycle and synchronous fact events.
- No procedure imports or uses an `observable` builder.
- Internal tRPC clients can forward call options through request context.
- Package typecheck and tests pass for touched packages.

## Stop Rule

After Stage 3 is committed, stop. Stage 4 must be re-planned before extension
execution is moved to callers.
