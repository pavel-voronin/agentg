# Internal Domain tRPC Migration

This plan migrates AgenTG away from the current gRPC/Protobuf implementation and
toward domain-owned tRPC internal APIs.

The plan is intentionally staged. Do not start the next stage until the current
stage meets its Definition of Done. Re-plan each stage before implementation; the
steps below describe boundaries and acceptance criteria, not a frozen task list.

This plan supersedes the gRPC target described in
[Internal Domain RPC Migration](internal-domain-rpc-migration.md). The earlier
plan remains useful historical context for the domain-boundary work, but gRPC and
Protobuf are no longer the target implementation.

Architecture decision:
[ADR-0005](../07-decisions/ADR-0005-use-domain-owned-trpc-for-internal-rpc.md).

## Target State

- Domains own their storage, lifecycle, invariants, public internal API, input
  validation, output validation, and request handling.
- Internal TypeScript-to-TypeScript commands and reads use tRPC over HTTP.
- Each domain defines its tRPC router inside the owning package.
- There is no shared contracts package for internal RPC contracts.
- Consumers may import the public router type from the owning domain package.
  They must not import private domain implementation code.
- Every public internal procedure has explicit input and output validation.
- NATS is used for events only.
- Gateway remains the external edge for agents and other external systems.
- Control Plane browser traffic keeps using the current browser-facing WebSocket
  protocol for now.
- Control Plane UI does not call internal services directly from the browser.
  Server-side Control Plane code may call internal domain tRPC APIs.
- Large media payloads live outside internal RPC. RPC returns metadata and
  locators when that becomes necessary.
- Raw TDLib objects do not cross out of the Telegram domain as integration
  contracts.
- gRPC, Protobuf definitions, generated Protobuf TypeScript, and the
  `@agentg/proto` workspace package are removed.

## Stage 0: Documentation Baseline

Purpose: make the replacement target and migration gates explicit before runtime
changes continue.

Scope:

- Record the decision to replace gRPC/Protobuf with domain-owned tRPC.
- Mark ADR-0004 as superseded or add a new ADR that supersedes it.
- Link this plan from the roadmap.
- Document that the existing Gateway and Control Plane WebSocket protocols remain
  external/browser-facing edge protocols for now.
- Document that no new shared contracts package should be introduced for
  internal RPC.

Out of scope:

- No runtime code changes.
- No dependency changes.
- No service rewiring.
- No deletion of gRPC files yet.

Definition of Done:

- The roadmap points to this tRPC migration plan as the current internal RPC
  direction.
- The architecture decision record clearly states that gRPC/Protobuf is no longer
  the target for internal domain RPC.
- Documentation distinguishes domain-owned tRPC APIs from external Gateway and
  Control Plane WebSocket protocols.

## Stage 1: tRPC Foundation

Purpose: add enough tRPC infrastructure for domain-owned routers without
migrating business flows.

Stage re-plan:
[Internal Domain tRPC Stage 1 Plan](internal-domain-trpc-stage-1-plan.md).

Scope:

- Add tRPC and validator dependencies to the packages that will own or call
  internal tRPC APIs.
- Add package-local tRPC setup for Telegram and History.
- Define local conventions for context, errors, input validation, output
  validation, timeouts, and correlation ids.
- Keep service address configuration explicit for local development and Docker.
- Avoid creating a shared internal contracts package.

Out of scope:

- No History to Telegram migration yet.
- No Gateway to History migration yet.
- No Control Plane server to History migration yet.
- No external Gateway WebSocket protocol change.
- No browser-facing Control Plane protocol change.
- No removal of gRPC files yet.

Definition of Done:

- Telegram and History can host package-local tRPC routers in tests.
- A minimal tRPC client/server round trip is covered by tests.
- The foundation does not require a shared contracts package.
- Existing behavior is unchanged.
- Existing `npm run check` passes.

Stage 1 must be re-planned before implementation.

## Stage 2: Telegram History tRPC

Purpose: make Telegram expose the history-fetch surface through a domain-owned
tRPC API.

Stage re-plan:
[Internal Domain tRPC Stage 2 Plan](internal-domain-trpc-stage-2-plan.md).

Scope:

- Define the Telegram History tRPC router inside `@agentg/telegram`.
- Move Telegram History input and output validation into the Telegram package.
- Expose procedures for chat discovery and history page fetch.
- Make History call Telegram through a typed tRPC client.
- Keep Telegram responses domain-shaped and avoid exposing raw TDLib objects.
- Keep History job identifiers private to History.

Out of scope:

- No Gateway migration.
- No Control Plane migration.
- No broad Telegram API surface.
- No media blob transport through RPC.
- No external Gateway WebSocket protocol change.

Definition of Done:

- History no longer uses gRPC to ask Telegram for history.
- Telegram still publishes events to NATS.
- Telegram owns the router, validators, and handlers for the Telegram History
  internal API.
- History imports only the public Telegram History router type or public
  client entrypoint, not Telegram private implementation code.
- History tests cover the tRPC Telegram client boundary.
- Existing history backfill behavior still works.
- Existing `npm run check` passes.

Stage 2 must be re-planned before implementation.

## Stage 3: History Domain tRPC

Purpose: make History expose its command and read surface through a
domain-owned tRPC API.

Stage re-plan:
[Internal Domain tRPC Stage 3 Plan](internal-domain-trpc-stage-3-plan.md).

Scope:

- Define the History tRPC router inside `@agentg/history`.
- Move History input and output validation into the History package.
- Expose procedures for the current History command/read behavior.
- Make Gateway call History through a typed tRPC client behind the existing
  Gateway WebSocket method names.
- Make Control Plane server call History through a typed tRPC client behind the
  existing browser-facing WebSocket protocol.
- Keep History the only writer of history targets, coverage, and backfill
  job state.

Out of scope:

- No direct browser access to internal History tRPC.
- No replacement of Gateway as the agent edge.
- No external Gateway WebSocket protocol change.
- No browser-facing Control Plane protocol change.
- No object storage work unless a specific History response requires locators.

Definition of Done:

- Gateway no longer uses gRPC for History commands or reads.
- Control Plane server no longer uses gRPC for History commands or reads.
- Gateway and Control Plane browser-facing protocols remain compatible with the
  current clients.
- History owns the router, validators, and handlers for the History internal
  API.
- Gateway and Control Plane import only the public History router type or public
  client entrypoint, not History private implementation code.
- History tRPC tests cover at least one read and one command.
- Existing operator and gateway workflows still work.
- Existing `npm run check` passes.

Stage 3 must be re-planned before implementation.

## Stage 4: gRPC and Protobuf Removal

Purpose: remove the old transport, schema, generated code, and dependencies after
all internal RPC flows have moved to tRPC.

Stage re-plan:
[Internal Domain tRPC Stage 4 Plan](internal-domain-trpc-stage-4-plan.md).

Scope:

- Remove the `@agentg/proto` workspace package.
- Remove Protobuf source files and generated TypeScript.
- Remove gRPC helper code, generated client/server tests, and Protobuf generation
  scripts.
- Remove gRPC and Protobuf dependencies from package manifests and lockfiles.
- Remove runtime imports of `@agentg/proto`, `@grpc/grpc-js`, generated service
  types, and Protobuf helper code.
- Update Docker, local development, and interface documentation to describe tRPC
  internal RPC.
- Keep historical references only where they are explicitly framed as historical
  or superseded decisions.

Out of scope:

- No behavioral changes to Telegram, History, Gateway, or Control Plane.
- No event-plane redesign.
- No external protocol redesign.
- No package renaming unless explicitly accepted during the stage re-plan.

Definition of Done:

- `packages/proto` is no longer part of the workspace.
- The repository has no runtime gRPC or Protobuf code.
- `npm run proto:generate` no longer exists.
- gRPC and Protobuf dependencies are removed.
- Documentation no longer describes gRPC as the target internal RPC transport.
- Existing `npm run check` passes.

Stage 4 must be re-planned before implementation.

## Stage 5: Event Plane and Boundary Check

Purpose: confirm that removing gRPC did not weaken domain ownership or reintroduce
request/reply behavior through NATS or shared packages.

Stage re-plan:
[Internal Domain tRPC Stage 5 Plan](internal-domain-trpc-stage-5-plan.md).

Scope:

- Inventory all NATS subjects.
- Keep domain events.
- Confirm there are no addressed command/read subjects.
- Confirm Gateway and Control Plane recover read state through owned RPC or owned
  storage-backed read surfaces, not by replaying non-durable NATS events.
- Confirm internal RPC contracts are owned by the serving domain packages.
- Confirm no shared internal contracts package was introduced during migration.

Out of scope:

- No durable event store.
- No Kafka/RabbitMQ replacement.
- No service mesh.
- No broad plugin architecture redesign.

Definition of Done:

- NATS has no business request/reply paths.
- Documentation distinguishes events from internal tRPC and external edge
  protocols.
- Gateway, Control Plane server, Telegram, and History all recover read state
  through explicit domain-owned surfaces.
- Each internal RPC surface has a clear owning package.
- Existing `npm run check` passes.

Stage 5 must be re-planned before implementation.

## Hard Rules During Migration

- Do not create a shared internal contracts package.
- Do not import another domain's private code to bypass RPC.
- Do not expose raw TDLib objects as domain contracts.
- Do not move large media payloads through RPC.
- Do not add a discovery service for the current static topology.
- Do not let Gateway become the internal orchestrator.
- Do not change external Gateway or browser-facing Control Plane protocols as a
  side effect of internal RPC migration.
- Do not leave gRPC or Protobuf runtime code behind after the removal stage.
- Do not advance to the next stage with failing checks unless the failure is
  explicitly documented and accepted before moving on.
