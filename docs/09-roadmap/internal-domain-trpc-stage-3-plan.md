# Internal Domain tRPC Stage 3 Plan

Stage 3 migrates the History domain API from gRPC to a History-owned tRPC API.
Gateway and Control Plane keep their current external WebSocket protocols.

Parent plan:
[Internal Domain tRPC Migration](internal-domain-trpc-migration.md).

Decision:
[ADR-0005](../07-decisions/ADR-0005-use-domain-owned-trpc-for-internal-rpc.md).

## Stage Goal

Make Gateway and Control Plane server call History through History's
domain-owned tRPC API for existing History commands and reads.

## Implementation Choices

- Define the History router inside `@agentg/history`.
- Keep History input and output schemas with the History router and public
  History RPC client entrypoint.
- Treat read-only History procedures as queries.
- Treat target writes and sync requests as mutations.
- Preserve the existing `HISTORY_RPC_URL`, `HISTORY_RPC_HOST`, and
  `HISTORY_RPC_PORT` environment variable names during this stage.
- Keep the Gateway `history.*` JSON-RPC method names stable.
- Keep the Control Plane browser-facing WebSocket request and response shape
  stable.
- Expose a History-owned JSON-RPC adapter from `@agentg/history` so Gateway
  and Control Plane do not need to understand tRPC procedure names directly.
- Leave old History gRPC files in place until the gRPC and Protobuf removal
  stage.

## Concrete Scope

- Add History-owned request and response schemas for the current History command
  and read surface.
- Add a History tRPC router and HTTP server entrypoint.
- Start and stop the History tRPC server from the History service.
- Add a History-owned tRPC-backed JSON-RPC adapter for existing `history.*`
  method names.
- Change Gateway to use the History-owned tRPC adapter behind its current
  WebSocket protocol.
- Change Control Plane server to use the History-owned tRPC adapter behind its
  current browser-facing WebSocket protocol.
- Update boundary tests to cover a History tRPC read and command path.

## Explicit Non-Scope

- Do not change Gateway's external WebSocket protocol.
- Do not change Control Plane's browser-facing WebSocket protocol.
- Do not allow browser code to call internal History tRPC directly.
- Do not remove `@agentg/proto`.
- Do not remove History gRPC server/client files.
- Do not migrate Telegram again.
- Do not introduce a shared internal contracts package.
- Do not redesign History commands or read models.
- Do not move ownership of targets, coverage, or backfill jobs out of History
  Sync.

## Definition of Done

- History owns the router, validators, and handlers for the History
  internal API.
- History starts the History tRPC server.
- Gateway no longer uses gRPC to call History commands or reads.
- Control Plane server no longer uses gRPC to call History commands or reads.
- Gateway and Control Plane import only the public History RPC entrypoint, not
  History private implementation code.
- Gateway and Control Plane browser-facing protocols remain compatible with the
  current clients.
- Tests cover at least one History tRPC read and one History tRPC command.
- Existing operator and gateway workflows remain behaviorally unchanged.
- Existing `npm run check` passes.

## Stop Rule

After Stage 3 is done, stop. Stage 4 must be re-planned before any gRPC,
Protobuf, or `@agentg/proto` removal starts.
