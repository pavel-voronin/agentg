# Internal Domain tRPC Stage 2 Plan

Stage 2 migrates the Telegram History internal API from gRPC to a Telegram-owned
tRPC API. It must not migrate Gateway, Control Plane, or the History domain API.

Parent plan:
[Internal Domain tRPC Migration](internal-domain-trpc-migration.md).

Decision:
[ADR-0005](../07-decisions/ADR-0005-use-domain-owned-trpc-for-internal-rpc.md).

## Stage Goal

Make History call Telegram ingestion through Telegram's domain-owned tRPC
router for chat discovery and history page fetches.

## Implementation Choices

- Define the Telegram History router inside `@agentg/telegram`.
- Keep Telegram History input and output schemas with the Telegram router.
- Treat `listChats` as a query.
- Treat `fetchPage` as a mutation because it fetches from TDLib and persists
  normalized historical messages.
- Keep request and response payloads JSON-shaped.
- Preserve the existing `TELEGRAM_RPC_URL`, `TELEGRAM_RPC_HOST`, and
  `TELEGRAM_RPC_PORT` environment variable names during this stage.
- Keep History's `TelegramHistoryClient` interface stable for the executor
  and controller.
- Leave History's own History gRPC server in place until the History domain
  tRPC stage.

## Concrete Scope

- Add Telegram-owned request and response schemas for the Telegram History
  surface.
- Add a Telegram History tRPC router and HTTP server entrypoint.
- Start and stop the Telegram History tRPC server from Telegram ingestion.
- Change History's Telegram client implementation to use a typed tRPC
  client.
- Update History service wiring to instantiate the tRPC Telegram client.
- Replace the History Telegram client boundary test with a tRPC boundary
  test.
- Keep existing backfill behavior unchanged.

## Explicit Non-Scope

- Do not migrate Gateway to tRPC.
- Do not migrate Control Plane server to tRPC.
- Do not migrate History's public History API to tRPC.
- Do not remove `@agentg/proto`.
- Do not remove History gRPC server/client code.
- Do not change Gateway's external WebSocket protocol.
- Do not change Control Plane's browser-facing WebSocket protocol.
- Do not add a shared internal contracts package.
- Do not broaden Telegram's internal API beyond history chat discovery and
  history page fetch.

## Definition of Done

- Telegram owns the router, validators, and handlers for the Telegram History
  internal API.
- Telegram ingestion starts the Telegram History tRPC server.
- History no longer uses gRPC to call Telegram.
- History imports only Telegram's public RPC type or public client
  entrypoint, not Telegram private implementation code.
- History tests cover the tRPC Telegram client boundary.
- Telegram still publishes events to NATS.
- Existing history backfill behavior still works.
- Existing `npm run check` passes.

## Stop Rule

After Stage 2 is done, stop. Stage 3 must be re-planned before any Gateway,
Control Plane, or History public API migration starts.
