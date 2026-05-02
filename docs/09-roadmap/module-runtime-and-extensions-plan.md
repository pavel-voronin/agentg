# Module Runtime And Extensions Plan

This plan defines how AgenTG adds trusted internal modules, gives each module
owned storage, exposes module capabilities through Gateway, and supports
controlled data and RPC result extensions.

Parent context:

- [Internal Domain tRPC Migration](internal-domain-trpc-migration.md)
- [Domain Boundary Hardening Plan](domain-boundary-hardening-plan.md)
- [Component Boundaries](../02-architecture/component-boundaries.md)
- [Event Plane](../05-interfaces/event-plane.md)

Decision:
[ADR-0006: Use Trusted Service Modules And RPC Extensions](../07-decisions/ADR-0006-use-trusted-service-modules-and-rpc-extensions.md)

## Target State

- AgenTG modules run as independent trusted services inside the internal
  runtime contour.
- Every module has a stable slug used for service addressing, NATS subjects,
  table prefixes, logs, and capability names.
- Gateway aggregates agent-facing capabilities from core domains and additional
  modules.
- Domains and modules own their storage schema, migrations, lifecycle,
  invariants, internal RPC surface, and event subjects.
- The database package provides shared database infrastructure rather than one
  centralized domain schema.
- Public internal tRPC calls use a standard AgenTG response envelope.
- Observable RPC calls publish ephemeral lifecycle events with a `callId`.
- Enriched RPC calls synchronously attach registered extension results under a
  namespaced `extensions` object.
- Extension registrations are code-owned by modules and refreshed through direct
  RPC calls to target services.
- NATS remains the live event plane for facts and call lifecycle events.
- Infrastructure-level events and extension call results are ephemeral.

## Terms

Module means a trusted internal service that can own storage, expose RPC
methods, publish and consume NATS events, and register capabilities or
extensions.

Slug means the short stable module identifier, for example `summaries`. The slug
is used in service names, event subjects, table names, log fields, capability
names, and extension names.

Capability means an agent-facing operation exposed by a module or core domain
and collected by Gateway.

Extension means a module-owned RPC method registered against a target RPC method
so its result can be attached to the target call.

Target means the RPC method being extended, for example `history.getChatState`.

Response envelope means the standard successful or domain-error shape returned
by public AgenTG internal RPC methods.

## Stage 0: Documentation Baseline

Purpose: record the target architecture and prepare the staged implementation
work.

### Scope

- Add this staged plan to the roadmap documentation.
- Link this plan from `docs/09-roadmap/roadmap.md`.
- Add an ADR for the module runtime and extension model.
- Document the agreed terms: module, slug, capability, extension, target, and
  response envelope.
- Document the lifecycle relationship between module startup, extension
  registration, capability registration, and registry refresh.

### Explicit Non-Scope

- No runtime code changes.
- No database schema changes.
- No Gateway capability registry implementation.
- No module service implementation.
- No extension registration runtime implementation.

### Definition of Done

- The roadmap links to this plan.
- The ADR records the accepted runtime model.
- The documentation distinguishes module storage ownership, capability
  discovery, observable call events, and enriched call results.
- The documentation matches the current tRPC and NATS architecture.

### Stop Rule

After Stage 0 is done, stop. Stage 1 changes database ownership and must be
reviewed separately.

## Stage 1: Domain-Owned Storage And Migrations

Purpose: make database ownership match domain and module ownership.

### Scope

- Turn `@agentg/database` into the shared database infrastructure package:
  - Postgres pool creation;
  - Drizzle client creation helpers;
  - migration runner helpers;
  - health checks;
  - shared database configuration parsing.
- Move Telegram-owned table definitions and migrations into
  `@agentg/telegram`.
- Move History-owned table definitions and migrations into
  `@agentg/history-sync`.
- Keep table names prefixed by the owning domain or module slug:
  - `telegram_*`
  - `history_*`
  - `history_backfill_jobs` as History-owned queue state
  - `${slug}_*` for additional modules.
- Give every domain and module its own Drizzle migration folder.
- Give every domain and module its own migration journal table or migration
  journal schema.
- Add a domain migration command for each owned package.
- Add an aggregate local-development migration command that runs known domain
  and module migrations in a deterministic order.
- Update package imports so each domain imports its own schema from its own
  package.
- Preserve the existing runtime database URL configuration.

### Explicit Non-Scope

- No PostgreSQL role, grant, or permission hardening.
- No Kubernetes packaging.
- No Gateway capability registry implementation.
- No module capability discovery.
- No RPC envelope migration.
- No changes to external Gateway or Control Plane protocols.

### Definition of Done

- `@agentg/database` no longer owns Telegram or History domain table
  definitions.
- Telegram owns the schema and migrations for Telegram storage tables.
- History Sync owns the schema and migrations for History storage tables.
- Existing database migrations can be applied from a fresh database through the
  aggregate migration command.
- Existing domain services can create their Drizzle clients with their owned
  schema.
- Existing tests using database schema imports are updated to the owning
  packages.
- Existing `npm run check` passes.

### Stop Rule

After Stage 1 is done, stop. Stage 2 changes the internal RPC return contract
and must be reviewed separately.

## Stage 2: Standard RPC Envelope

Purpose: make public internal RPC responses consistent across ordinary,
observable, enriched, and extension methods.

### Scope

- Add shared envelope types:
  - successful envelope with `ok: true`, `result`, and `extensions`;
  - domain-error envelope with `ok: false`, `error`, and `extensions`;
  - extension envelope using the same success and error shape.
- Add shared envelope schemas for JSON-shaped values.
- Add a shared domain error shape with at least:
  - `code`;
  - `message`;
  - optional structured `details`.
- Add package-local tRPC runtime setup that exports these builder names:
  - `rpc`;
  - `observable`;
  - `enriched`;
  - `extension`.
- Keep raw tRPC setup private to each package-local runtime module.
- Make `rpc` wrap handler results in the standard envelope.
- Make output validation apply to the raw domain result before envelope wrapping.
- Make tRPC transport errors continue through tRPC's error path for invalid
  input, failed output validation, malformed requests, and process-level
  failures.
- Add lint restrictions that keep direct `@trpc/server` imports inside the
  package-local tRPC runtime files.
- Update existing public internal routers to use the new builders.
- Update typed clients and tests to expect the standard envelope.

### Explicit Non-Scope

- No observable lifecycle event publication.
- No progress event API.
- No enriched extension execution.
- No module capability registration.
- No domain storage migration work.
- No external Gateway or Control Plane protocol migration.

### Definition of Done

- Public internal RPC methods return the standard envelope.
- `rpc`, `observable`, `enriched`, and `extension` are the only exported builder
  names for new internal RPC methods.
- Raw tRPC procedure builders are private implementation details.
- Output validation still validates the domain result shape.
- Domain errors can be represented as `ok: false` envelopes.
- Existing internal RPC tests cover success and domain-error envelopes.
- Existing `npm run check` passes.

### Stop Rule

After Stage 2 is done, stop. Stage 3 adds lifecycle event behavior and must be
reviewed separately.

## Stage 3: Observable Calls And Progress Events

Purpose: let selected RPC calls publish ephemeral lifecycle events while keeping
their response shape identical to other wrapped calls.

### Scope

- Implement the `observable` builder on top of the standard envelope runtime.
- Generate a `callId` for each observable RPC invocation.
- Publish call lifecycle events to NATS:
  - `rpc.call.started`;
  - `rpc.call.progress`;
  - `rpc.call.completed`;
  - `rpc.call.failed`.
- Include these fields in lifecycle events:
  - `callId`;
  - source service slug;
  - target method name;
  - input where available;
  - output where available;
  - error where available;
  - timestamps.
- Add a `ctx.progress(...)` API for observable handlers.
- Make `ctx.progress(...)` publish `rpc.call.progress` events with the current
  `callId`.
- Keep the response envelope for `observable` identical to `rpc`.
- Add tests for started, progress, completed, and failed event publication.
- Update service logs to include `callId` where practical.

### Explicit Non-Scope

- No enriched extension execution.
- No extension registration registry.
- No Gateway capability registry implementation.
- No module service runtime implementation.
- No persistent storage for call lifecycle events.
- No external Gateway or Control Plane protocol migration.

### Definition of Done

- Observable methods return the same envelope shape as `rpc` methods.
- Observable methods publish started and completed events for successful calls.
- Observable methods publish failed events for domain-error and thrown-error
  paths according to the runtime mapping.
- Handlers can publish progress without manually constructing event envelopes.
- Event publication failures are visible in logs.
- Existing `npm run check` passes.

### Stop Rule

After Stage 3 is done, stop. Stage 4 adds synchronous extension execution and
must be reviewed separately.

## Stage 4: Enriched Calls And Extension Registration

Purpose: allow selected RPC methods to attach synchronous module-owned extension
results without changing the base result.

### Scope

- Implement the `extension` builder for module-owned extension RPC methods.
- Implement the `enriched` builder on top of the observable runtime.
- Add a local in-memory extension registry to every service that exposes
  enriched targets.
- Add a runtime RPC method on target services for extension registration.
- Use the registration payload:

  ```json
  {
    "target": "history.getChatState",
    "extension": "summaries.chatSummary"
  }
  ```

- Resolve the extension service from the slug prefix of `extension`.
- Use `extension` as the key under the target response's `extensions` object.
- Refresh extension registrations from module startup code.
- Expire stale local registry entries according to target-service runtime
  policy.
- When an enriched target is called:
  - run the base handler;
  - validate the raw output;
  - publish observable lifecycle events;
  - look up registered extensions for the target;
  - call registered extension RPC methods in parallel;
  - pass `callId`, `target`, `input`, and `output` to each extension method;
  - attach each extension envelope under `extensions[extension]`.
- Add timeout handling for extension RPC calls.
- Represent extension timeout or failure as an extension error envelope.
- Add uniqueness validation for extension names per target.
- Add tests for registration, refresh, stale cleanup, successful enrichment,
  timeout handling, and duplicate extension rejection.

### Explicit Non-Scope

- No Gateway capability registry implementation.
- No module runtime helper implementation beyond what extension registration
  needs.
- No persistent storage for extension registrations.
- No persistent storage for extension call results.
- No extension ordering or priority policy.
- No external Gateway or Control Plane protocol migration.

### Definition of Done

- Enriched methods return the same top-level envelope shape as `rpc` and
  `observable` methods.
- Enriched methods populate `extensions` with registered extension envelopes.
- Extension methods receive the full target input and full target output.
- Extension failures are isolated to the relevant extension envelope.
- Extension registrations are refreshed and stale entries are removed.
- Two active registrations cannot claim the same extension name for one target.
- Existing `npm run check` passes.

### Stop Rule

After Stage 4 is done, stop. Stage 5 adds module and Gateway capability
registration and must be reviewed separately.

## Stage 5: Module Runtime And Gateway Capabilities

Purpose: make trusted modules first-class services that can register
agent-facing capabilities and participate in extension registration.

### Scope

- Define the module runtime contract:
  - slug;
  - service RPC URL;
  - NATS URL;
  - database URL;
  - table prefix convention;
  - migration folder;
  - capability names;
  - extension registrations.
- Add module configuration loading for local development and Docker Compose.
- Add helper functions for module startup:
  - load config;
  - create database client;
  - run health check;
  - connect event bus;
  - start tRPC server;
  - register capabilities with Gateway;
  - register extensions with target services;
  - refresh ephemeral registrations.
- Add Gateway capability registry RPC.
- Make modules register capabilities with Gateway at startup.
- Make modules refresh capability registrations periodically.
- Make Gateway expose registered capabilities to external agent clients.
- Keep capability execution routed through the owning module RPC method.
- Add a registry read RPC that lists active capabilities and active extensions
  known to a service.
- Add Docker Compose conventions for module services:
  - service name equals slug;
  - internal RPC port;
  - `DATABASE_URL`;
  - `NATS_URL`;
  - needed `*_RPC_URL` values.
- Add tests for Gateway capability registration, refresh, stale cleanup, and
  capability proxying.

### Explicit Non-Scope

- No concrete product module implementation.
- No summaries domain implementation.
- No Kubernetes packaging.
- No PostgreSQL role, grant, or permission hardening.
- No changes to existing Gateway WebSocket request envelopes beyond exposing
  registered capabilities through the planned capability surface.
- No Control Plane UI work.

### Definition of Done

- A module can register a capability with Gateway through RPC.
- Gateway can list registered module capabilities.
- Gateway can proxy a capability call to the owning module.
- Capability registrations are refreshed and stale entries are removed.
- A module can register an extension with a target service during startup.
- Docker Compose can start core services and at least one module service through
  the documented conventions.
- Existing `npm run check` passes.

### Stop Rule

After Stage 5 is done, stop. Stage 6 proves the design with a concrete module
and must be reviewed separately.

## Stage 6: Summaries Pilot Module

Purpose: prove the module runtime, owned storage, Gateway capabilities,
observable call events, and enriched call results with one useful module.

### Scope

- Add a `summaries` module service.
- Give the module owned tables using the `summaries_` prefix.
- Add `summaries` migrations and a `summaries` migration journal.
- Subscribe to relevant Telegram and History events for summary invalidation and
  work scheduling.
- Store private module state for summary runs, summary results, source
  references, and invalidation state.
- Expose module RPC methods for:
  - requesting a summary;
  - reading a chat summary;
  - reading summary run state;
  - serving an extension method for a chosen enriched target.
- Register at least one Gateway capability from `summaries`.
- Register at least one extension from `summaries` against an enriched core
  target.
- Return summary extension results under the extension name, for example
  `summaries.chatSummary`.
- Publish module-owned events for summary lifecycle facts.
- Add tests for module storage, RPC methods, capability registration, and
  enrichment behavior.

### Explicit Non-Scope

- No generic UI for all modules.
- No Control Plane module marketplace.
- No production-grade scheduling framework for module jobs.
- No model-provider abstraction beyond what the pilot module needs.
- No PostgreSQL role, grant, or permission hardening.
- No Kubernetes packaging.

### Definition of Done

- `summaries` owns its schema and migrations.
- `summaries` can run as its own service in local development.
- Gateway lists and proxies at least one `summaries` capability.
- A core enriched target can return a `summaries` extension result.
- Summary invalidation state remains private to `summaries`.
- Module events use the `summaries.` subject prefix.
- Existing `npm run check` passes.

### Stop Rule

After Stage 6 is done, stop. Stage 7 updates cross-cutting documentation and
audits the implementation.

## Stage 7: Documentation And Boundary Audit

Purpose: make the implemented module and extension architecture explicit and
guard it against regressions.

### Scope

- Update architecture documentation with:
  - module runtime boundaries;
  - owned storage and migration conventions;
  - Gateway capability aggregation;
  - standard RPC envelope;
  - observable call events;
  - enriched extension registration and execution.
- Update operations documentation for:
  - running module migrations;
  - starting module services in Docker Compose;
  - inspecting active capability and extension registries;
  - debugging `callId` flows.
- Add source audits for:
  - direct raw tRPC builder imports;
  - cross-domain schema imports;
  - module table prefix conventions;
  - Gateway capability registry behavior.
- Add example snippets for `rpc`, `observable`, `enriched`, and `extension`.
- Add a compact module authoring checklist.

### Explicit Non-Scope

- No runtime feature work.
- No new module implementation.
- No Gateway protocol redesign.
- No Control Plane UI redesign.
- No database schema migration.

### Definition of Done

- Documentation describes the implemented runtime behavior.
- New module authors have a checklist for slug, storage, migrations, RPC,
  events, capabilities, and extensions.
- Source audits cover raw tRPC usage and cross-domain storage imports.
- Operations documentation explains how to run and inspect modules locally.
- Existing `npm run check` passes.

### Stop Rule

After Stage 7 is done, treat module runtime and extension support as the current
baseline for future module work.
