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

- Publish `started`, `progress`, `completed`, and `failed` lifecycle events by
  default for internal RPC procedures.
- Remove `observable` as a procedure builder.
- Add call options:
  - `observable?: boolean`;
  - `silent?: boolean`.
- Pass call options outside domain input through tRPC operation context and HTTP
  headers.
- Use per-request header handling that can preserve different call options for
  different calls.
- Make `observable: false` suppress only lifecycle events for the current RPC
  call.
- Make `silent: true` suppress lifecycle events and synchronously published fact
  events for the current RPC handler only.

## Explicit Non-Scope

- Do not silence asynchronous work after the RPC handler returns.
- Do not add durable event storage.
- Do not add cancellation semantics.
- Do not alter event subject names except where direct RPC result conversion
  requires test fixture updates.

## Definition of Done

- Tests cover default lifecycle publishing.
- Tests cover `observable: false` preserving synchronous fact events.
- Tests cover `silent: true` suppressing lifecycle and synchronous fact events.
- No procedure imports or uses an `observable` builder.
- Package typecheck and tests pass for touched packages.

## Stop Rule

After Stage 3 is committed, stop. Stage 4 must be re-planned before extension
execution is moved to callers.
