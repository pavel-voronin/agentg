# Internal Domain RPC Stage 2 Plan

Stage 2 migrates only the History to Telegram history-fetch path from NATS
request/reply to gRPC.

Parent plan:
[Internal Domain RPC Migration](internal-domain-rpc-migration.md).

Foundation:
[Internal Domain RPC Stage 1 Plan](internal-domain-rpc-stage-1-plan.md).

Decision:
[ADR-0004](../07-decisions/ADR-0004-use-grpc-protobuf-for-internal-domain-rpc.md).

## Stage Goal

History should call Telegram through Telegram's domain-owned gRPC API when
it needs chat discovery or historical message page fetches.

## Concrete Scope

- Add a Telegram History Protobuf service.
- Generate TypeScript gRPC client/server types.
- Start a Telegram-owned gRPC server inside the Telegram ingestion process.
- Implement Telegram History gRPC methods using the existing TDLib-backed
  history logic.
- Change History to create a generated gRPC Telegram History client.
- Keep History jobs, targets, coverage, and lifecycle private to History
  Sync.
- Remove the Telegram history NATS request/reply command surface.

## Explicit Non-Scope

- Do not migrate Gateway to History RPC.
- Do not migrate Control Plane.
- Do not change History's own NATS command surface.
- Do not change Telegram live events.
- Do not move media blobs through gRPC.
- Do not introduce retries, deduplication tables, or cancellation mechanics.

## Contract Shape

Service: `agentg.telegram.v1.TelegramHistoryService`.

Methods:

- `ListChats`
- `FetchPage`

The API returns domain-shaped Telegram history DTOs:

- chat id, title, and type;
- fetch result kind;
- page counters and cursor metadata.

It must not expose raw TDLib objects. It must not accept or return History
job identifiers.

## Definition of Done

- History no longer calls Telegram through NATS request/reply.
- Telegram no longer registers Telegram history NATS responders.
- Telegram starts and stops a gRPC server around the existing ingestion process.
- History uses generated gRPC client code for Telegram history calls.
- Tests cover the History Telegram gRPC client boundary.
- Existing NATS events remain unchanged.
- `npm run proto:generate` passes.
- `npm run check` passes.
- `npm run build` passes.

## Stop Rule

After Stage 2 is done, stop. Stage 3 must be re-planned before any Gateway to
History migration starts.
