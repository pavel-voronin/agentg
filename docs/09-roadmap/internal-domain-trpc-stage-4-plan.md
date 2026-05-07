# Internal Domain tRPC Stage 4 Plan

Stage 4 removes the old gRPC and Protobuf implementation after Telegram,
History, Gateway, and Control Plane server have moved to domain-owned tRPC
for internal RPC.

Parent plan:
[Internal Domain tRPC Migration](internal-domain-trpc-migration.md).

Decision:
[ADR-0005](../07-decisions/ADR-0005-use-domain-owned-trpc-for-internal-rpc.md).

## Stage Goal

Remove the obsolete Protobuf workspace, generated code, gRPC server/client
adapters, generation scripts, package dependencies, Docker wiring, and current
documentation references.

## Implementation Choices

- Remove `packages/proto` completely from the active workspace.
- Remove `npm run proto:generate`.
- Remove the old History gRPC server adapter from History.
- Remove gRPC and Protobuf dependencies from package manifests and lockfiles.
- Keep environment variable names such as `HISTORY_RPC_URL` and
  `TELEGRAM_RPC_URL` during this stage because they now point to HTTP tRPC
  service roots.
- Update current local development, interface, and event-plane docs to describe
  internal tRPC.
- Keep superseded gRPC roadmap and ADR text as historical documentation when it
  is clearly superseded.

## Concrete Scope

- Delete the `@agentg/proto` workspace package and all Protobuf source/generated
  files.
- Delete History's old `history-api.ts` gRPC adapter.
- Remove `@agentg/proto` from History dependencies.
- Remove Protobuf and gRPC package-lock entries that are no longer used.
- Remove `packages/proto` from root workspaces.
- Remove `proto:generate` from root scripts.
- Remove `packages/proto/package.json` copies from the Dockerfile.
- Update current docs that still describe internal gRPC as the active runtime
  path.
- Run the full repository check.

## Explicit Non-Scope

- Do not change Gateway's external WebSocket protocol.
- Do not change Control Plane's browser-facing WebSocket protocol.
- Do not redesign tRPC routers, procedure names, or payload shapes.
- Do not rename `*_RPC_*` environment variables.
- Do not remove historical superseded ADRs or old roadmap documents merely
  because they mention gRPC.
- Do not redesign the event plane.

## Definition of Done

- `packages/proto` is gone from the workspace.
- `npm run proto:generate` no longer exists.
- No runtime package imports `@agentg/proto` or `@grpc/grpc-js`.
- No active package depends on gRPC or Protobuf runtime packages.
- Docker packaging no longer copies the removed Protobuf workspace.
- Current operations and interface docs describe tRPC internal RPC.
- Existing `npm run check` passes.

## Stop Rule

After Stage 4 is done, stop. Stage 5 must be re-planned before any event-plane
or boundary audit work starts.
