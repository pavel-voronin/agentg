# Module Runtime And Extensions

Trusted modules are independent internal services that run inside the AgenTG
runtime contour. A module owns its storage, tRPC surface, events, capabilities,
and extensions. Core domains use the same rules where they expose extensible
behavior.

## Runtime Contract

Every module has:

- `slug`: stable short name, for example `summaries`
- `serviceRpcUrl`: internal tRPC service URL
- `natsUrl`: NATS Core URL
- `databaseUrl`: Postgres URL
- `tablePrefix`: owned table prefix, for example `summaries_`
- `migrationFolder`: module-owned Drizzle migration folder
- `capabilities`: agent-facing methods registered with Gateway
- `extensionRegistrations`: module RPC methods registered against enriched
  target methods

The shared helpers live in `@agentg/shared/modules/runtime`. They load the
runtime config, register capabilities, register extensions, and refresh
ephemeral registrations.

## Storage

The database package provides Postgres and Drizzle infrastructure only. Domains
and modules own schemas and migrations in their own packages:

- `@agentg/telegram`: `telegram_*`, journal `__drizzle_migrations_telegram`
- `@agentg/history-sync`: `history_*`, journal `__drizzle_migrations_history`
- `@agentg/summaries`: `summaries_*`, journal
  `__drizzle_migrations_summaries`

Cross-domain table reads and writes are a boundary violation. A module that
needs another domain's data calls that domain's tRPC surface.

## RPC Envelope

Public internal tRPC methods return the AgenTG envelope:

```json
{
  "ok": true,
  "result": {},
  "extensions": {}
}
```

Domain errors use the same top-level shape:

```json
{
  "ok": false,
  "error": {
    "code": "not_found",
    "message": "Value was not found"
  },
  "extensions": {}
}
```

## Procedure Builders

Package-local tRPC runtimes expose these builder names.

`rpc` is the default closed method:

```ts
readChatSummary: rpc
  .input(summariesReadChatSummaryInputSchema)
  .output(procedureEnvelopeSchema(summariesReadChatSummaryOutputSchema))
  .query(({ input }) => readChatSummary(runtime, input.chatId));
```

`observable` publishes live events named from the RPC target and lifecycle, for
example `history.getChatHistoryState.started`, optional
`history.getChatHistoryState.progress`, `history.getChatHistoryState.completed`,
and `history.getChatHistoryState.failed`, with one `callId`:

```ts
requestSummary: observable
  .input(summariesRequestSummaryInputSchema)
  .output(procedureEnvelopeSchema(summariesRequestSummaryOutputSchema))
  .mutation(({ ctx, input }) => {
    ctx.progress({
      message: 'Creating chat summary',
      stage: 'summaries.requested'
    });
    return requestChatSummary(runtime, input);
  });
```

`enriched` is an observable method that also calls active extension
registrations and appends extension envelopes:

```ts
getChatHistoryState: enriched
  .input(historyGetChatHistoryStateInputSchema)
  .output(procedureEnvelopeSchema(historyChatHistoryStateOutputSchema))
  .query(({ input }) => getChatHistoryState(runtime, input));
```

`extension` is a module-owned method registered against an enriched target:

```ts
chatSummary: extension
  .input(summariesChatSummaryExtensionInputSchema)
  .output(procedureEnvelopeSchema(summariesChatSummaryExtensionOutputSchema))
  .query(({ input }) => getChatSummaryExtension(runtime, chatIdFromExtensionOutput(input.output)));
```

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
module tRPC method and unwraps the standard envelope.

## Extensions

Extension registration is direct and ephemeral. A module registers its extension
with the target service:

```json
{
  "target": "history.getChatHistoryState",
  "extension": "summaries.chatSummary"
}
```

The target service stores the registration in memory. When the enriched target
runs, it passes the full target input and full target output to the extension
RPC method. The base result remains unchanged. Extension failures are isolated
to that extension envelope.

## Source Audits

`npm run source:audit` guards the current boundary rules:

- raw `@trpc/server` builder imports are only allowed in package-local
  `src/rpc/trpc.ts` runtimes
- cross-domain storage schema imports are rejected
- domain and module table names must use their owner prefix
- Gateway capability registry/proxy behavior must stay covered by source and
  tests

The audit is part of `npm run check`.

## Module Authoring Checklist

- Pick a stable slug and use it for service name, table prefix, event subjects,
  capability names, extension names, and logs.
- Create a package-owned `src/schema.ts`, `drizzle/` folder, migration command,
  and migration journal table.
- Use only owned tables for writes. Call other domains through tRPC.
- Expose public internal methods through package-local `rpc`, `observable`,
  `enriched`, or `extension` builders.
- Return all public internal results through `procedureEnvelopeSchema`.
- Publish module events with the slug prefix.
- Register Gateway capabilities at startup and refresh them periodically.
- Register extensions with target services at startup and refresh them
  periodically.
- Add tests for storage behavior, RPC envelopes, capability registration/proxy,
  and enriched extension output.
