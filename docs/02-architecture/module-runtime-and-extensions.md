# Module Runtime And Extensions

Trusted modules are independent internal services that run inside the AgenTG
runtime contour. A module owns its storage, tRPC surface, events, capabilities,
and extension getter methods. Core domains own their own models, procedures,
storage, and fact events; they do not know which modules extend them.

## Runtime Contract

Every module has:

- `slug`: stable short name, for example `summaries`
- `serviceRpcUrl`: internal tRPC service URL
- `natsUrl`: NATS Core URL
- `databaseUrl`: Postgres URL
- `tablePrefix`: owned table prefix, for example `summaries_`
- `migrationFolder`: module-owned Drizzle migration folder
- `capabilities`: agent-facing methods registered with Gateway
- `extensionRegistrations`: `{ target, extension }` entries registered with the
  standalone extension registry

The shared helpers live in `@agentg/shared/modules/runtime`. They load runtime
config, register capabilities, register extensions, and refresh ephemeral
registrations.

## Storage

The database package provides Postgres and Drizzle infrastructure only. Domains
and modules own schemas and migrations in their own packages:

- `@agentg/telegram`: `telegram_*`, journal `__drizzle_migrations_telegram`
- `@agentg/history-sync`: `history_*`, journal `__drizzle_migrations_history`
- `@agentg/summaries`: `summaries_*`, journal
  `__drizzle_migrations_summaries`

Cross-domain table reads and writes are a boundary violation. A module that
needs another domain's data calls that domain's tRPC surface.

## RPC Results

Internal tRPC methods return their result bodies directly. A read that returns a
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

Package-local tRPC runtimes expose `rpc` as the procedure builder:

```ts
readChatSummary: rpc
  .input(summariesReadChatSummaryInputSchema)
  .output(summariesReadChatSummaryOutputSchema)
  .query(({ input }) => readChatSummary(runtime, input.chatId));
```

RPC lifecycle events are published by default. Event names use
`{target}.{lifecycle}`, for example:

- `history.getChatHistoryState.started`
- `history.getChatHistoryState.progress`
- `history.getChatHistoryState.completed`
- `history.getChatHistoryState.failed`

Callers can pass call options through internal RPC context:

- `observable: false` suppresses lifecycle events for the current RPC call.
- `silent: true` suppresses lifecycle events and synchronous fact events
  published inside the current RPC handler.

There is no `observable` procedure builder. `observable` is only a call option.

## Capabilities

Gateway owns the external agent WebSocket boundary and keeps an in-memory
capability registry. Modules register capabilities at startup and refresh them
periodically:

```json
{
  "moduleSlug": "summaries",
  "name": "summaries.requestChatSummary",
  "serviceUrl": "http://summaries:8080",
  "rpcMethod": "summaries.requestSummary",
  "rpcType": "mutation"
}
```

External clients call `capabilities.list` to inspect active capabilities and
`capabilities.call` to invoke one. Gateway proxies execution to the owning
module tRPC method and returns the direct result.

## Extensions

Extension registration is direct and ephemeral. A module registers a getter RPC
method with the standalone extension registry:

```json
{
  "target": "telegram.chat",
  "extension": "summaries.chatSummary"
}
```

The registry stores and lists active registrations only. It does not call RPC
methods and does not own service discovery.

An extension getter receives the marked model object directly:

```ts
chatSummary: rpc
  .input(summariesChatSummaryInputSchema)
  .output(summariesChatSummaryOutputSchema)
  .query(({ input }) => getChatSummaryExtension(runtime, input.id));
```

Caller code composes an extended view when it needs one:

1. Call the base procedure.
2. Collect objects with `_model` and `id`.
3. Ask the extension registry which getters target that `_model`.
4. Call the extension getter RPC methods through known service URLs.
5. Assemble the view locally.

Gateway exposes this pattern through `extensions.compose`. Domains do not call
extension RPC methods while serving base domain procedures.

## Source Audits

`npm run source:audit` guards the current boundary rules:

- raw `@trpc/server` builder imports are only allowed in package-local
  `src/rpc/trpc.ts` runtimes
- cross-domain storage schema imports are rejected
- domain and module table names must use their owner prefix
- Gateway capability registry/proxy behavior stays covered by source and tests
- domain runtime code cannot reintroduce `enriched`
- History and Telegram cannot expose local extension registries
- the extension registry cannot import tRPC client code
- Gateway extension composition stays covered by source and tests

The audit is part of `npm run check`.

## Module Authoring Checklist

- Pick a stable slug and use it for service name, table prefix, event subjects,
  capability names, extension names, and logs.
- Create a package-owned `src/schema.ts`, `drizzle/` folder, migration command,
  and migration journal table.
- Use only owned tables for writes. Call other domains through tRPC.
- Expose public internal methods through package-local `rpc`.
- Return public internal results directly.
- Publish module events with the slug prefix.
- Register Gateway capabilities at startup and refresh them periodically.
- Register extension getters with the standalone extension registry at startup
  and refresh them periodically.
- Add tests for storage behavior, direct RPC results, capability
  registration/proxy, extension registration, and caller-side composition.
