# Module Runtime

Trusted modules are independent internal services that run inside the AgenTG
runtime contour. A module owns its storage, module RPC surface, and events.
Core domains own their own models, procedures, storage, and fact events.

## Target Runtime Stack

The current target runtime is TypeScript/Node.js packages running as trusted
internal services inside one local contour.

Modules communicate through typed internal RPC clients, publish live events
through NATS Core, and persist owned state in Postgres through package-owned
Drizzle schemas and migrations. Scheduling, durable run state, retries, and
idempotency are owned by the module that defines that lifecycle, not by a
separate plugin platform.

The runtime does not introduce a separate plugin ABI, WebAssembly layer, durable
event journal, or cross-module capability registry for this implementation.

## Runtime Contract

Every module has:

- `module`: stable short name, for example `llm-runner`
- `serviceRpcUrl`: internal module RPC service URL when the module exposes
  public internal RPC procedures
- `natsUrl`: NATS Core URL
- `databaseUrl`: Postgres URL
- `tablePrefix`: owned table prefix, for example `llm_runner_`
- `migrationFolder`: module-owned Drizzle migration folder
- package-local procedure map returned by module `setup()`; runtime-only or
  edge-boundary modules return an empty map
- a package-owned typed RPC client exported from the package root when another
  package currently consumes that module

Runtime config helpers live with the current module runtime owner. Process
Compose, Docker Compose, or the production supervisor owns service ordering and
service addresses.

## Static RPC Clients

Internal cross-module calls use package-owned typed clients built with
`defineInternalRpcDomain`. A consumer imports the client from the serving
package root and supplies the service URL from its runtime config:

```ts
import { telegramClient } from '@agentg/telegram';

const telegram = telegramClient({ url: config.telegramRpcUrl });
```

The owning package derives the client type from the module definition. The
definition carries a type-only procedure marker based on the `setup()` return
type; the runtime app does not expose `app.procedures`:

```ts
import { defineInternalRpcDomain, type ProceduresOf } from '@agentg/framework';
import type { telegramModule } from './module.js';

export const telegramClient =
  defineInternalRpcDomain<ProceduresOf<typeof telegramModule>>('telegram');
```

Consumers do not import another package's module runtime, procedure schemas, or
procedure DTO types. The root client is the cross-package public surface. The
client's service name is also the `rpc.service` telemetry label for client RPC
spans and duration metrics.

## Module Procedure Declaration

Module `setup()` returns the module's procedure map directly. The map is
instance-level: procedures may close over resources created in the same setup,
such as databases, TDLib handles, event buses, controllers, or typed clients.

```ts
export const telegramModule = defineModule('telegram', {
  config: readConfig,
  setup({ config, events, resource }) {
    const database = resource('database', ({ startup }) => {
      const databaseResource = createDatabase(config.databaseUrl);
      startup(() => databaseResource.start());
      return databaseResource.db;
    });

    return {
      getChat: getChatProcedure({ database, events }),
      getMessages: getMessagesProcedure({ database, events })
    };
  }
});
```

The framework starts the module RPC server from the returned RPC procedure map
after startup resources are ready and before background processes start. When a
module returns no public RPC procedures, no RPC connector is required and no
empty RPC server is started. When a module returns public RPC procedures without
an RPC connector, startup fails.

`ModuleApp` exposes only lifecycle methods: `start()` and `stop()`.

## Storage

The database package provides Postgres and Drizzle infrastructure only. Domains
and modules own schemas and migrations in their own packages:

- `@agentg/telegram`: `telegram_*`, journal `__drizzle_migrations_telegram`
- `@agentg/data`: `data_*`, journal `__drizzle_migrations_data`
- `@agentg/pipelines`: `pipelines_*`, journal `__drizzle_migrations_pipelines`
- `@agentg/llm-runner`: `llm_runner_*`, journal
  `__drizzle_migrations_llm_runner`
- `@agentg/triggers`: `triggers_*`, journal `__drizzle_migrations_triggers`

Cross-domain table reads and writes are a boundary violation. A module that
needs another domain's data calls that domain's module RPC surface.

Shared model access goes through `data` provider capabilities. A provider module
keeps lifecycle ownership for its models and exposes model-level procedures to
`data`; `data` routes `select`, `get`, `expand`, and `render` calls without
reading provider-owned tables.

## RPC Results

Internal module RPC methods return their result bodies directly. A read that
returns a chat returns the chat shape, not a compatibility envelope.

## RPC Failures

Typed internal RPC clients classify failures by boundary:

- Transport failure: the client could not complete the HTTP call to the
  configured service URL. Examples: connection refused, DNS failure, and timeout.
- Protocol failure: the configured service answered in a way that did not
  produce a valid domain result. Examples: invalid URL, non-JSON response,
  invalid RPC envelope, unknown procedure, and payload too large.
- Domain procedure failure: the call reached the serving module procedure and
  that procedure failed while executing domain logic.

Transport and protocol failures are infrastructure failures. Callers that expose
an edge protocol, such as Gateway or Dashboard server, map them to dependency
unavailability for that edge. Domain procedure failures remain method failures
for the edge method that invoked the procedure.

## Gateway RPC

Gateway owns the external agent WebSocket boundary directly. Modules do not
register capabilities with Gateway, and Gateway does not keep a capability
catalog. Every external Gateway RPC method is a deliberate Gateway-owned method
implemented in Gateway code.

## Source Audits

`npm run source:audit` guards the current boundary rules:

- cross-domain storage schema imports are rejected
- domain and module table names must use their owner prefix
- provider-owned model access goes through `data` provider capabilities
- Gateway's external RPC and event surface stays covered by source and tests
- domain runtime code cannot reintroduce `enriched`
- Dashboard frontend code keeps `host.rpc(...)` calls inside local `api.ts`
  wrappers under the owning module's Dashboard frontend tree

The audit is part of `npm run check`.

## Module Authoring Checklist

- Pick a stable module name and use it for service name, table prefix, event
  subjects, and logs.
- Create a package-owned `src/schema.ts`, `drizzle/` folder, migration command,
  and migration journal table.
- Use only owned tables for writes. Call other domains through module RPC.
- Return public internal methods directly from module `setup()` only for modules
  that expose an internal RPC surface. Runtime-only or edge-boundary modules
  return an empty procedure map and register their process through `startup()` or
  `background()`.
- Export a typed client from the package root only when a real current consumer
  imports it.
- Return public internal results directly.
- Publish module events with the module name prefix.
- Wire process startup order and module RPC URLs in Process Compose, Docker
  Compose, or the production supervisor.
- Add tests for storage behavior, direct RPC results, typed client calls, and
  caller-side procedure routing.
