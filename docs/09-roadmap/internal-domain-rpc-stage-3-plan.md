# Internal Domain RPC Stage 3 Plan

Stage 3 migrates only the Gateway to History Sync command/read path from NATS
request/reply to gRPC.

Parent plan:
[Internal Domain RPC Migration](internal-domain-rpc-migration.md).

Foundation:
[Internal Domain RPC Stage 1 Plan](internal-domain-rpc-stage-1-plan.md).

Previous stage:
[Internal Domain RPC Stage 2 Plan](internal-domain-rpc-stage-2-plan.md).

Decision:
[ADR-0004](../07-decisions/ADR-0004-use-grpc-protobuf-for-internal-domain-rpc.md).

## Stage Goal

Gateway should call History Sync through History's domain-owned gRPC API for
current `history.*` external methods.

## Concrete Scope

- Add a History Protobuf service.
- Generate TypeScript gRPC client/server types.
- Start a History-owned gRPC server inside the History Sync process.
- Implement explicit History gRPC methods for the current Gateway-facing history
  API:
  - `GetOverview`
  - `ListChats`
  - `GetChatHistoryState`
  - `UpsertTarget`
  - `DeleteTarget`
  - `RequestSync`
  - `ListJobs`
- Change Gateway's history adapter to call the generated gRPC client.
- Remove the old `agentg.command.history.rpc` NATS request/reply surface.

## Explicit Non-Scope

- Do not split Control Plane into a server boundary.
- Do not change Gateway's external WebSocket protocol.
- Do not migrate Telegram read methods.
- Do not remove History or Telegram events from NATS.
- Do not add a discovery service.
- Do not add retry orchestration, deduplication tables, or cancellation
  mechanics.

## Definition of Done

- Gateway no longer sends `history.*` calls through NATS request/reply.
- History Sync no longer registers `agentg.command.history.rpc`.
- History Sync starts and stops a gRPC server around the existing service
  lifecycle.
- Gateway uses generated History gRPC client code.
- Tests cover the Gateway to History gRPC client boundary.
- Existing Gateway WebSocket method names remain unchanged for external clients.
- Existing NATS events remain unchanged.
- `npm run proto:generate` passes.
- `npm run check` passes.
- `npm run build` passes.

## Stop Rule

After Stage 3 is done, stop. Stage 4 must be re-planned before any Control Plane
server boundary work starts.
