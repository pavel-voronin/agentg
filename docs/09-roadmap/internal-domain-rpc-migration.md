# Internal Domain RPC Migration

This plan migrates AgenTG toward explicit domain-owned RPC boundaries.

The plan is intentionally staged. Do not start the next stage until the current
stage meets its Definition of Done. Re-plan each stage before implementation; the
steps below describe boundaries and acceptance criteria, not a frozen task list.

Architecture decision: [ADR-0004](../07-decisions/ADR-0004-use-grpc-protobuf-for-internal-domain-rpc.md).

## Target State

- Domains own their storage, lifecycle, invariants, and public internal API.
- Internal commands and reads use gRPC with Protobuf contracts.
- NATS is used for events only.
- Gateway is only the external edge for agents and external systems.
- Control Plane UI does not call internal services directly from the browser.
  Server-side Control Plane code may call internal domain RPC.
- Large media payloads live in object storage. RPC returns metadata and locators.
- Raw TDLib objects do not cross out of the Telegram domain as integration
  contracts.

## Stage 0: Documentation Baseline

Purpose: make the target architecture and migration gates explicit before more
code changes.

Scope:

- Record the internal RPC decision.
- Record the migration stages and DoD.
- Link the plan from the roadmap and ADR index.

Out of scope:

- No runtime code changes.
- No transport dependency changes.
- No NATS subject removals.
- No service rewiring.

Definition of Done:

- ADR exists and clearly selects gRPC plus Protobuf.
- Migration plan exists with stage boundaries and DoD.
- Documentation states that NATS request/reply is current-state debt, not target
  architecture.

## Stage 1: RPC Foundation

Purpose: add the shared gRPC/Protobuf foundation without migrating business
flows.

Stage re-plan:
[Internal Domain RPC Stage 1 Plan](internal-domain-rpc-stage-1-plan.md).

Scope:

- Add a repo location for Protobuf service definitions.
- Add Protobuf code generation for TypeScript.
- Add shared conventions for generated clients and server registration.
- Add internal RPC bind config for services that will expose gRPC.
- Add internal RPC URL config for services that will call other domains.
- Update local development and Docker Compose documentation for service URLs and
  ports.

Out of scope:

- No History to Telegram migration yet.
- No Gateway to History migration yet.
- No Control Plane architecture change yet.
- No removal of existing NATS RPC.

Definition of Done:

- A minimal generated Protobuf client/server round trip is covered by tests.
- Service address config works both locally and in Docker Compose.
- Existing behavior is unchanged.
- Existing `npm run check` passes.

Stage 1 must be re-planned before implementation.

## Stage 2: Telegram History RPC

Purpose: make Telegram expose the history-fetch surface through its domain RPC.

Stage re-plan:
[Internal Domain RPC Stage 2 Plan](internal-domain-rpc-stage-2-plan.md).

Scope:

- Define Telegram History Protobuf service.
- Telegram service exposes gRPC methods for chat discovery and history page fetch.
- History Sync calls Telegram through generated gRPC client.
- Telegram returns domain-shaped responses, not raw TDLib objects.
- History job identifiers remain private to History Sync.

Out of scope:

- No Gateway migration.
- No Control Plane migration.
- No broad Telegram API surface.
- No media blob transport through gRPC.

Definition of Done:

- History Sync no longer uses NATS request/reply to ask Telegram for history.
- Telegram history NATS command subjects are removed or left as temporary
  compatibility only if the stage re-plan explicitly accepts that debt.
- Telegram still publishes events to NATS.
- History Sync tests cover the gRPC Telegram client boundary.
- Existing history backfill behavior still works.
- Existing `npm run check` passes.

Stage 2 must be re-planned before implementation.

## Stage 3: History Domain RPC

Purpose: make History Sync expose its command and read surface through domain RPC.

Stage re-plan:
[Internal Domain RPC Stage 3 Plan](internal-domain-rpc-stage-3-plan.md).

Scope:

- Define History Protobuf service.
- History Sync exposes gRPC methods for current `history.*` command/read
  behavior.
- Gateway calls History through generated gRPC client for external API handling.
- History remains the only writer of history targets, coverage, and backfill job
  state.

Out of scope:

- No Control Plane server split unless explicitly re-planned into this stage.
- No direct browser access to internal History RPC.
- No object storage work unless a specific History response requires locators.

Definition of Done:

- Gateway no longer uses NATS request/reply for History API calls.
- History NATS command subjects are removed or explicitly documented as temporary
  debt in the stage re-plan.
- Gateway remains the external edge protocol and does not become an internal
  orchestrator.
- History RPC tests cover at least one read and one command.
- Existing Control Plane behavior still works through its current edge path.
- Existing `npm run check` passes.

Stage 3 must be re-planned before implementation.

## Stage 4: Control Plane Server Boundary

Purpose: stop treating the browser UI as an internal service participant.

Stage re-plan:
[Internal Domain RPC Stage 4 Plan](internal-domain-rpc-stage-4-plan.md).

Scope:

- Introduce or clarify a server-side Control Plane boundary.
- Browser UI talks to Control Plane server.
- Control Plane server calls internal domain RPC directly.
- Control Plane server subscribes to the event plane when it needs live updates.

Out of scope:

- No direct browser calls to Telegram, History, or NATS.
- No requirement that all external agents go through Control Plane.
- No replacement of Gateway as the agent edge.

Definition of Done:

- Control Plane UI no longer depends on Gateway for internal operator views unless
  the stage re-plan explicitly keeps that as temporary debt.
- Control Plane server uses generated domain RPC clients.
- Browser-facing API is separate from internal domain RPC.
- Existing operator workflows still work.
- Existing `npm run check` passes.

Stage 4 must be re-planned before implementation.

## Stage 5: Event Plane Cleanup

Purpose: make NATS usage match the target architecture.

Stage re-plan:
[Internal Domain RPC Stage 5 Plan](internal-domain-rpc-stage-5-plan.md).

Scope:

- Inventory all NATS subjects.
- Keep domain events.
- Remove addressed command/read subjects.
- Document event naming and payload ownership.
- Ensure event consumers can recover state through domain RPC or storage-owned
  read surfaces, not by replaying non-durable NATS events.

Out of scope:

- No durable event store.
- No Kafka/RabbitMQ replacement.
- No service mesh.

Definition of Done:

- NATS has no business request/reply paths.
- Documentation distinguishes events from RPC.
- Gateway, Control Plane server, Telegram, and History all recover read state
  through explicit domain-owned surfaces.
- Existing `npm run check` passes.

Stage 5 must be re-planned before implementation.

## Hard Rules During Migration

- Do not import another domain's private code to bypass RPC.
- Do not expose raw TDLib objects as domain contracts.
- Do not move large media payloads through RPC.
- Do not add a discovery service for the current static topology.
- Do not let Gateway become the internal orchestrator.
- Do not advance to the next stage with failing checks unless the failure is
  explicitly documented and accepted before moving on.
