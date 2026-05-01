# Internal Domain tRPC Stage 1 Plan

Stage 1 adds the tRPC foundation only. It must not migrate History, Telegram,
Gateway, or Control Plane business flows.

Parent plan:
[Internal Domain tRPC Migration](internal-domain-trpc-migration.md).

Decision:
[ADR-0005](../07-decisions/ADR-0005-use-domain-owned-trpc-for-internal-rpc.md).

## Stage Goal

Create a minimal package-local tRPC foundation for internal domain APIs without
introducing a shared contracts package or changing runtime behavior.

## Implementation Choices

- Use tRPC v11 packages.
- Use Zod for procedure input and output validation.
- Keep tRPC setup local to each domain package that owns a router.
- Add a Telegram-local tRPC setup under `packages/telegram/src/rpc`.
- Add a History Sync-local tRPC setup under `packages/history-sync/src/rpc`.
- Keep service URL parsing as ordinary HTTP service-root URL parsing.
- Preserve the existing `*_RPC_*` environment variable names during this stage.
- Use tRPC's standalone HTTP adapter in tests and later service entrypoints.
- Do not add `superjson` in this stage. Internal public contract values should
  stay JSON-shaped unless a later stage explicitly changes that.

## Concrete Scope

- Add tRPC and Zod dependencies needed for domain-owned routers and typed clients.
- Add package-local tRPC helpers for:
  - router creation;
  - public procedure creation;
  - context creation;
  - error formatting;
  - HTTP service URL parsing.
- Add one minimal test router in Telegram or History Sync tests to prove a tRPC
  client can call a package-local tRPC HTTP server.
- Ensure the foundation does not import or depend on `@agentg/proto`.
- Document any local conventions that implementation exposes in code names.

## Explicit Non-Scope

- Do not migrate History Sync to call Telegram through tRPC yet.
- Do not migrate Gateway to call History through tRPC yet.
- Do not migrate Control Plane server to call History through tRPC yet.
- Do not remove `@agentg/proto`.
- Do not remove gRPC servers, clients, Protobuf files, or generated code.
- Do not change Gateway's external WebSocket protocol.
- Do not change Control Plane's browser-facing WebSocket protocol.
- Do not add a shared internal contracts package.
- Do not add auth, retry orchestration, deduplication tables, or cancellation
  policy beyond basic client-side request timeouts.

## Definition of Done

- Telegram has package-local tRPC setup available for later Telegram-owned
  routers.
- History Sync has package-local tRPC setup available for later History-owned
  routers.
- A Vitest test proves a package-local tRPC client can call a package-local tRPC
  HTTP server.
- Added dependencies are scoped to the packages that need them.
- No business flow has changed.
- No shared internal contracts package has been added.
- Existing `npm run check` passes.

## Stop Rule

After Stage 1 is done, stop. Stage 2 must be re-planned before any
History-to-Telegram tRPC migration starts.
