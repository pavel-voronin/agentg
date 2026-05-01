# Internal Domain RPC Stage 4 Plan

Stage 4 introduces a server-side Control Plane boundary and moves the operator
browser UI off the Agent Gateway path.

Parent plan:
[Internal Domain RPC Migration](internal-domain-rpc-migration.md).

Previous stage:
[Internal Domain RPC Stage 3 Plan](internal-domain-rpc-stage-3-plan.md).

Decision:
[ADR-0004](../07-decisions/ADR-0004-use-grpc-protobuf-for-internal-domain-rpc.md).

## Stage Goal

The browser UI should talk to a Control Plane server that owns the browser-facing
operator API. That server may call internal domain RPC and subscribe to internal
events. Gateway remains the external agent edge.

## Concrete Scope

- Add a Control Plane server runtime in the `@agentg/control-plane` package.
- Keep the browser-facing protocol WebSocket plus JSON RPC for the current UI.
- Serve Control Plane UI assets from the Control Plane server for packaged and
  Docker runs.
- Route current `history.*` operator calls from Control Plane server to History
  Sync through the generated History gRPC client.
- Subscribe Control Plane server to `telegram.>` and `history.>` NATS events and
  forward them to connected browser clients.
- Change the browser UI client to connect to Control Plane server instead of
  Agent Gateway.
- Keep the current Gateway WebSocket protocol for external agent clients.
- Document local and Docker service addresses for the Control Plane server.

## Explicit Non-Scope

- Do not replace Gateway as the agent-facing edge.
- Do not remove Gateway's external `history.*` WebSocket methods.
- Do not remove NATS event subjects.
- Do not migrate Telegram read methods.
- Do not add a discovery service.
- Do not add a new internal API gateway or orchestrator.
- Do not add retry orchestration, cancellation mechanics, or persistent request
  state.

## Boundary Rules

- Browser code may only call the Control Plane server.
- Control Plane server may call generated internal domain RPC clients.
- Control Plane server may subscribe to NATS events for live updates.
- Control Plane server must not import another domain's private implementation
  code.
- Control Plane server must not read or write History-owned tables directly.

## Definition of Done

- Control Plane UI no longer references Agent Gateway WebSocket config.
- Control Plane UI connects to Control Plane server by default.
- Control Plane server uses generated History gRPC client code for `history.*`
  operator calls.
- Control Plane server forwards live `telegram.>` and `history.>` events to the
  browser UI.
- Gateway remains available for external clients and is not required for operator
  views.
- Tests cover the Control Plane browser-facing boundary.
- Local development docs show how to run the Control Plane server.
- Docker Compose can run Control Plane server with internal service DNS.
- `npm run check` passes.
- `npm run build` passes.

## Stop Rule

After Stage 4 is done, stop. Stage 5 must be re-planned before any event plane
cleanup starts.
