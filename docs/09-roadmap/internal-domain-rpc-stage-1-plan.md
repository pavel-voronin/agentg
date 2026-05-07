# Internal Domain RPC Stage 1 Plan

Stage 1 adds the RPC foundation only. It must not migrate History, Telegram,
Gateway, or Control Plane business flows.

Parent plan:
[Internal Domain RPC Migration](internal-domain-rpc-migration.md).

Decision:
[ADR-0004](../07-decisions/ADR-0004-use-grpc-protobuf-for-internal-domain-rpc.md).

## Stage Goal

Create a working gRPC plus Protobuf foundation that later stages can use without
re-deciding tooling, package layout, or local service addressing.

## Implementation Choices

- Add a new workspace package: `@agentg/proto`.
- Store source `.proto` files under `packages/proto/proto`.
- Generate TypeScript under `packages/proto/src/generated`.
- Use `ts-proto` for TypeScript code generation.
- Use `@grpc/grpc-js` as the Node gRPC runtime.
- Keep generated files committed so services do not need to generate code at
  runtime.
- Use explicit local env vars for service URLs instead of a discovery service.

## Concrete Scope

- Add one minimal internal health/check service as a foundation test contract.
- Add `proto:generate` wiring.
- Add a generated client/server round-trip test.
- Add reusable helpers for:
  - local gRPC target parsing from internal service URLs;
  - gRPC deadlines;
  - correlation-id metadata.
- Add RPC bind/client config fields to current service configs without starting
  any new gRPC servers yet.
- Document local and Docker service address defaults.

## Explicit Non-Scope

- Do not migrate History to call Telegram over gRPC.
- Do not migrate Gateway to call History over gRPC.
- Do not remove any NATS request/reply subjects.
- Do not start gRPC servers in Telegram, History, Gateway, or Control Plane.
- Do not add dynamic service discovery.
- Do not add retry orchestration, deduplication tables, or cancellation logic.

## Definition of Done

- `@agentg/proto` is part of the workspace.
- `npm run proto:generate` produces generated TypeScript from `.proto` files.
- A Vitest test proves a generated gRPC client can call a generated gRPC server.
- Current service config loaders expose future RPC bind/client settings.
- Docker Compose has internal RPC env defaults for services that will need them.
- Documentation explains local and Docker addressing.
- `npm run check` passes.

## Stop Rule

After Stage 1 is done, stop. Stage 2 must be re-planned before any
History-to-Telegram migration starts.
