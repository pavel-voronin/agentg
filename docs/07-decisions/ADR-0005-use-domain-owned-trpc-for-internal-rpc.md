# ADR-0005: Use Domain-Owned tRPC for Internal RPC

## Status

Accepted.

## Context

AgenTG uses explicit domain-owned access surfaces. The domain separation is
useful, but generated transport and schema tooling are heavier than the project
currently needs.

The current system is TypeScript-first:

- Telegram ingestion, History Sync, Gateway, and Control Plane server are all
  TypeScript packages.
- Existing external Gateway and Control Plane browser protocols already use JSON
  over WebSocket.
- History Sync behavior is already shaped around method-level command/read handlers.
- The project does not currently need non-TypeScript service clients, gRPC
  streaming, or Protobuf compatibility guarantees.

The gRPC implementation adds generated code, Protobuf files, adapter mappings,
and package-level indirection. It also creates pressure to centralize contracts
in a shared package, which weakens domain ownership. A domain should own its
public internal API, validation rules, handlers, and invariants in the same
package that owns the domain behavior.

## Decision

Use tRPC over HTTP for internal TypeScript-to-TypeScript domain RPC.

This means:

- Each domain package defines and owns its public internal tRPC router.
- Input and output validation live with the owning domain router.
- Consumers may import the public router type or a public client entrypoint from
  the owning domain package.
- Consumers must not import another domain's private implementation code.
- Do not introduce a shared internal contracts package for these RPC contracts.
- NATS remains the event plane only.
- Gateway remains the external agent edge.
- Control Plane browser traffic keeps its current browser-facing WebSocket
  protocol for now.
- Internal service URLs remain explicit configuration. No dynamic service
  discovery is introduced.
- gRPC, Protobuf source files, generated Protobuf TypeScript, and a shared
  Protobuf workspace are not part of the target implementation.

## Terms

tRPC is the internal RPC framework for TypeScript service-to-service commands and
reads.

Domain-owned router means the serving package owns the router, procedure names,
input validators, output validators, handler wiring, and domain error mapping.

External edge protocol means the protocol exposed to browser or agent clients.
The current Gateway and Control Plane WebSocket protocols are external edge
protocols and are not changed by this decision.

NATS is the internal live event bus. It carries facts that happened, not
addressed domain reads or commands.

## Consequences

Benefits:

- Domain contracts stay with the domain that owns the behavior.
- TypeScript clients get end-to-end type safety without Protobuf code generation.
- Input and output validation are explicit at the procedure boundary.
- The repo does not need generated Protobuf code or gRPC adapter mappings.
- Internal RPC remains simpler to debug and evolve while the system is
  TypeScript-only.
- Gateway and Control Plane can keep their current external protocols while their
  server-side internals move to tRPC.

Costs:

- Internal RPC becomes TypeScript-coupled.
- Non-TypeScript service clients would need a different integration strategy in
  the future.
- tRPC router types must be exported carefully so consumers do not depend on
  private domain code.
- Output validation must be a project rule; inferred return types alone are not
  enough for runtime contract discipline.
- Reintroducing a generated transport layer would need a separate architecture
  decision.

Non-goals:

- No shared internal contracts package.
- No broad REST redesign.
- No external Gateway protocol migration in this decision.
- No browser-facing Control Plane protocol migration in this decision.
- No NATS request/reply revival.
- No service mesh or dynamic discovery system.
- No attempt to move large media payloads through internal RPC.

## Operational Defaults

Service discovery remains static.

Inside Docker or a future orchestrator, services address each other through
service DNS names such as `telegram` and `history-sync`.

In local development, services receive explicit URLs through environment
variables. Existing `*_RPC_*` variable names may remain during the migration
because RPC no longer means gRPC.

Every internal RPC call should have a timeout at the client boundary.

Every internal RPC call may carry a correlation id. Correlation ids are for
logging and debugging only; they are not business ids and do not imply
idempotency.

## Documentation

Current internal RPC ownership is documented in
[Event Plane](../05-interfaces/event-plane.md) and
[Local Development](../06-operations/local-dev.md).
