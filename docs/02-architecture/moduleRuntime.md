# Module Runtime

Trusted modules are independent internal services that run inside the AgenTG
runtime contour. A module owns its storage, module RPC surface, and events.
Core domains own their own models, procedures, storage, and fact events.

## Runtime Contract

Every module has:

- `module`: stable short name, for example `analysis`
- `serviceRpcUrl`: internal module RPC service URL
- `natsUrl`: NATS Core URL
- `databaseUrl`: Postgres URL
- `tablePrefix`: owned table prefix, for example `analysis_`
- `migrationFolder`: module-owned Drizzle migration folder
- `procedures`: module RPC procedure names declared in the Registry manifest
- `required`: whether loss of the service breaks whole-runtime availability

Runtime config helpers live with the current module runtime owner. Service
registration is owned by the Registry client.

## Registry

Registry owns runtime topology and procedure routing metadata. Every service
joins it with one manifest:

```json
{
  "module": "analysis",
  "rpcUrl": "http://analysis:8080",
  "required": false,
  "procedures": ["analysis.requestReport", "analysis.chatInsights"]
}
```

Registry returns a versioned snapshot. Framework clients keep the snapshot
locally and refresh it only through explicit `getSnapshot` calls.

Registry does not call domain or module RPC methods.

## Storage

The database package provides Postgres and Drizzle infrastructure only. Domains
and modules own schemas and migrations in their own packages:

- `@agentg/telegram`: `telegram_*`, journal `__drizzle_migrations_telegram`
- `@agentg/history-sync`: `history_sync_*`, journal
  `__drizzle_migrations_history_sync`

Cross-domain table reads and writes are a boundary violation. A module that
needs another domain's data calls that domain's module RPC surface.

## RPC Results

Internal module RPC methods return their result bodies directly. A read that
returns a chat returns the chat shape, not a compatibility envelope.

## Procedure Builder And Call Options

Package-local module RPC runtimes expose `rpc` as the procedure builder:

```ts
readModuleState: rpc
  .input(readModuleStateInputSchema)
  .output(readModuleStateOutputSchema)
  .query(({ input }) => readModuleState(runtime, input.id));
```

RPC lifecycle events are published by default. Event names use
`{domain}.rpc.{procedure}.{lifecycle}`, for example:

- `history-sync.rpc.getChatHistorySyncState.started`
- `history-sync.rpc.getChatHistorySyncState.progress`
- `history-sync.rpc.getChatHistorySyncState.completed`
- `history-sync.rpc.getChatHistorySyncState.failed`

Callers can pass call options through internal RPC context:

- `observable: false` suppresses lifecycle events for the current RPC call.
- `silent: true` suppresses lifecycle events and synchronous fact events
  published inside the current RPC handler.

There is no `observable` procedure builder. `observable` is only a call option.

## Gateway RPC

Gateway owns the external agent WebSocket boundary directly. Modules do not
register capabilities with Gateway, and Gateway does not keep a capability
registry. Every external Gateway RPC method is a deliberate Gateway-owned method
implemented in Gateway code.

## Source Audits

`npm run source:audit` guards the current boundary rules:

- cross-domain storage schema imports are rejected
- domain and module table names must use their owner prefix
- Gateway's external RPC and event surface stays covered by source and tests
- domain runtime code cannot reintroduce `enriched`
- Registry server code cannot call service RPC methods

The audit is part of `npm run check`.

## Module Authoring Checklist

- Pick a stable module name and use it for service name, table prefix, event
  subjects, and logs.
- Create a package-owned `src/schema.ts`, `drizzle/` folder, migration command,
  and migration journal table.
- Use only owned tables for writes. Call other domains through module RPC.
- Expose public internal methods through package-local `rpc`.
- Return public internal results directly.
- Publish module events with the module name prefix.
- Join Registry with procedures and `required` at startup.
- Add tests for storage behavior, direct RPC results, Registry manifest shape,
  and caller-side procedure routing.
