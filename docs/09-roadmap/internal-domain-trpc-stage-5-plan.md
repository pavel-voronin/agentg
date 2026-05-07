# Internal Domain tRPC Stage 5 Plan

Stage 5 audits the event plane and domain boundaries after gRPC and Protobuf
removal. It should not introduce new runtime behavior unless the audit finds a
boundary violation.

Parent plan:
[Internal Domain tRPC Migration](internal-domain-trpc-migration.md).

Decision:
[ADR-0005](../07-decisions/ADR-0005-use-domain-owned-trpc-for-internal-rpc.md).

## Stage Goal

Confirm that internal reads and commands now use domain-owned tRPC surfaces,
NATS remains event-only, and no shared internal contracts package replaced the
removed Protobuf workspace.

## Implementation Choices

- Treat `@agentg/events/bus` as the only supported NATS abstraction.
- Keep that abstraction limited to publish and subscribe.
- Treat `docs/05-interfaces/event-plane.md` as the active event-plane inventory.
- Audit source code for NATS request/reply APIs and shared contract imports.
- Prefer documentation updates over runtime edits when the implementation already
  matches the intended boundary.
- Keep external Gateway and Control Plane WebSocket protocols unchanged.

## Concrete Scope

- Inventory Telegram and History NATS subjects.
- Confirm all NATS subjects are event notifications, not addressed commands or
  reads.
- Confirm Gateway and Control Plane recover state through WebSocket RPC methods
  backed by Postgres and History tRPC.
- Confirm History recovers through its own Postgres tables and Telegram
  tRPC.
- Confirm Telegram ingestion recovers through TDLib and Telegram-shaped Postgres
  storage.
- Confirm internal RPC contracts are owned by `@agentg/telegram` and
  `@agentg/history`.
- Confirm no shared internal contracts package exists.
- Update current event-plane documentation with the audit result.
- Run the full repository check.

## Explicit Non-Scope

- Do not redesign NATS usage.
- Do not add a durable event store.
- Do not add Kafka, RabbitMQ, a service mesh, or discovery.
- Do not change Gateway's external WebSocket protocol.
- Do not change Control Plane's browser-facing WebSocket protocol.
- Do not change tRPC procedure names or payload shapes.
- Do not add a shared contracts package.

## Definition of Done

- The event-plane inventory lists current Telegram and History subjects.
- Documentation states that NATS exposes no business request/reply paths.
- Documentation distinguishes events, internal tRPC, and external WebSocket
  protocols.
- Each internal RPC surface has a clear owning package.
- Source audit finds no runtime NATS request/reply usage.
- Existing `npm run check` passes.

## Stop Rule

After Stage 5 is done, stop. Future event durability, plugin boundaries, or
external protocol redesigns need separate plans.
