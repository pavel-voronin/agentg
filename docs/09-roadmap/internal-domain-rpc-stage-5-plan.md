# Internal Domain RPC Stage 5 Plan

Stage 5 cleans up the event plane after the command/read paths have moved to
domain RPC.

Parent plan:
[Internal Domain RPC Migration](internal-domain-rpc-migration.md).

Previous stage:
[Internal Domain RPC Stage 4 Plan](internal-domain-rpc-stage-4-plan.md).

Decision:
[ADR-0004](../07-decisions/ADR-0004-use-grpc-protobuf-for-internal-domain-rpc.md).

## Stage Goal

NATS should be a non-durable event plane only. Internal commands and reads should
use generated gRPC clients, while event subscribers use domain RPC or owned
storage to recover state after reconnects.

## Concrete Scope

- Inventory current NATS subjects and classify them as events, temporary debt, or
  removable command/read subjects.
- Remove the old `EventBus.request` and `EventBus.respond` request/reply API.
- Remove the old History target NATS request/reply subjects:
  - `history.target.upsert.requested`
  - `history.target.delete.requested`
- Stop using `history.sync.requested` as a command transport. History may
  still publish it as a notification event, but its controller must be woken
  directly inside the History process.
- Keep live event fan-out subjects used by Gateway and Control Plane server:
  - `telegram.>`
  - `history.>`
- Document event naming, payload ownership, and recovery rules.

## Explicit Non-Scope

- Do not add durable event storage.
- Do not replace NATS with Kafka, RabbitMQ, Redis, or a service mesh.
- Do not change Gateway or Control Plane browser-facing protocols.
- Do not change Protobuf service definitions unless cleanup exposes a real
  mismatch.
- Do not remove user-visible event notifications from Control Plane.
- Do not add retries, cancellation, deduplication tables, or persistent command
  state.

## Event Plane Rules

- Event subjects describe facts that happened, not addressed procedure calls.
- Event payloads are owned by the publishing domain.
- Events are live notifications only; they are not a replay log.
- Consumers must rebuild read state through domain RPC or their own owned
  storage after reconnects.
- NATS wildcards are allowed for fan-out subscriptions such as `telegram.>` and
  `history.>`.

## Definition of Done

- No production code calls `EventBus.request` or `EventBus.respond`.
- Shared `EventBus` no longer exposes request/reply helpers.
- History no longer registers target command responders on NATS.
- History no longer subscribes to `history.sync.requested` to wake its own
  controller.
- Gateway and Control Plane server still receive live `telegram.>` and
  `history.>` notifications.
- Event plane documentation lists current subjects and recovery surfaces.
- `npm run check` passes.
- `npm run build` passes.

## Stop Rule

After Stage 5 is done, stop. Any further event schema cleanup, event
deduplication, or durable event-store work must be planned separately.
