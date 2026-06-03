# Module Runtime And Extensions

Trusted modules are independent internal services that run inside the AgenTG
runtime contour. A module owns its storage, module RPC surface, events, and extension
getter methods. Core domains own their own models, procedures, storage, and fact
events; they do not know which modules extend them.

## Runtime Contract

Every module has:

- `slug`: stable short name, for example `analysis`
- `serviceRpcUrl`: internal module RPC service URL
- `natsUrl`: NATS Core URL
- `databaseUrl`: Postgres URL
- `tablePrefix`: owned table prefix, for example `analysis_`
- `migrationFolder`: module-owned Drizzle migration folder
- `extensions`: `{ target, extension }` entries declared in its Service
  Directory manifest

Runtime config helpers live with the current module runtime owner. Service
registration is owned by the Registry client.

## Service Directory

Service Directory owns runtime topology and extension declarations. Every
service joins it with one manifest:

```json
{
  "slug": "analysis",
  "rpcUrl": "http://analysis:8080",
  "procedures": [
    { "name": "analysis.requestReport", "kind": "mutation" },
    { "name": "analysis.chatInsights", "kind": "query" }
  ],
  "events": ["analysis.report.completed"],
  "extensions": [
    {
      "target": "telegram.chat",
      "extension": "analysis.chatInsights"
    }
  ]
}
```

Service Directory returns a lease and a versioned snapshot. Clients keep the
snapshot locally, renew their lease, subscribe to `service_directory.changed`,
and pull a fresh snapshot when the event carries a newer version. The event is
an invalidation signal only; the durable truth is `getSnapshot`.

Service Directory does not call domain or module RPC methods.

## Storage

The database package provides Postgres and Drizzle infrastructure only. Domains
and modules own schemas and migrations in their own packages:

- `@agentg/telegram`: `telegram_*`, journal `__drizzle_migrations_telegram`
- `@agentg/history-sync`: `history_sync_*`, journal `__drizzle_migrations_history_sync`

Cross-domain table reads and writes are a boundary violation. A module that
needs another domain's data calls that domain's module RPC surface.

## RPC Results

Internal module RPC methods return their result bodies directly. A read that returns a
chat returns the chat shape, not `{ ok, result, extensions }`.

Models that are valid extension targets mark themselves inline with `_model` and
their stable `id`:

```json
{
  "_model": "telegram.chat",
  "id": "123",
  "title": "Saved Messages",
  "type": "private"
}
```

The marker is part of the object itself. There is no envelope `meta` field and
no nested `modelRef` object.

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

## Extensions

Extension declaration is part of the service manifest:

```json
{
  "target": "telegram.chat",
  "extension": "analysis.chatInsights"
}
```

The Service Directory snapshot lists active extension declarations with the
owning service slug and RPC URL. It does not call extension RPC methods.

An extension getter receives the marked model object directly:

```ts
chatInsights: rpc
  .input(chatInsightsInputSchema)
  .output(chatInsightsOutputSchema)
  .query(({ input }) => getChatInsights(runtime, input.id));
```

Caller code composes an extended view when it needs one:

1. Call the base procedure.
2. Collect objects with `_model` and `id`.
3. Read the local Service Directory snapshot for getters targeting that `_model`.
4. Call the extension getter RPC methods through known service URLs.
5. Assemble the view locally.

Gateway does not expose extension composition as an external RPC method. Callers
that need composed views own that composition flow explicitly.

## Source Audits

`npm run source:audit` guards the current boundary rules:

- cross-domain storage schema imports are rejected
- domain and module table names must use their owner prefix
- Gateway's external RPC and event surface stays covered by source and tests
- domain runtime code cannot reintroduce `enriched`
- History Sync and Telegram cannot expose local extension registries
- Service Directory server code cannot call service RPC methods

The audit is part of `npm run check`.

## Module Authoring Checklist

- Pick a stable slug and use it for service name, table prefix, event subjects,
  extension names, and logs.
- Create a package-owned `src/schema.ts`, `drizzle/` folder, migration command,
  and migration journal table.
- Use only owned tables for writes. Call other domains through module RPC.
- Expose public internal methods through package-local `rpc`.
- Return public internal results directly.
- Publish module events with the slug prefix.
- Join Service Directory with procedures, events, and extension declarations at
  startup.
- Add tests for storage behavior, direct RPC results, Service Directory
  manifest shape, and caller-side composition.
