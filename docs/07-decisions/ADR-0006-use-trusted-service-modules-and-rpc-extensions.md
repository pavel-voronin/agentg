# ADR-0006: Use Trusted Service Modules And RPC Extensions

## Status

Accepted. Updated by the direct extension-registry migration.

## Context

AgenTG has a working internal contour made of domain services, Postgres, NATS,
Gateway, and Control Plane. Domains own their tRPC APIs and storage. NATS carries
live facts rather than addressed commands or reads.

The next layer of product value needs additional modules such as summarization,
classification, search, and higher-order analysis. These modules need to run
inside the trusted contour, store their own state, expose their own operations,
and provide extra views for existing domain models without moving that
composition into the owning domain.

The project is a trusted pet-project deployment. The module runtime should
optimize for simple ownership, explicit contracts, local development, and clear
extension behavior rather than hard isolation.

## Decision

Use trusted internal services as the module unit.

Each module is an independent service with a stable slug. The slug is used for
service addressing, NATS subjects, table prefixes, logs, capability names, and
extension names.

Each domain and module owns its storage schema and migrations. The shared
database package provides database infrastructure, not one centralized domain
schema. Domains and modules write only their owned tables by convention.

Gateway aggregates agent-facing capabilities from core domains and additional
modules. Capability registration is ephemeral and refreshed by the owning
service.

Internal tRPC procedures return direct result bodies. Model objects that callers
can extend mark themselves inline with `_model` and their existing `id`.

RPC lifecycle events are published by default. Callers can pass:

- `observable: false` to suppress lifecycle events for the current call.
- `silent: true` to suppress lifecycle events and synchronous fact events
  published by the current handler.

Extension registration is handled by a standalone Extension Registry service.
The registry stores and lists registrations only:

```json
{
  "target": "telegram.chat",
  "extension": "summaries.chatSummary"
}
```

The registry does not call extension RPC methods and does not own service
discovery.

Extension methods are module-owned getter RPC methods. The extension name is the
RPC method name. For model extensions, the getter receives the marked model
object directly:

```json
{
  "_model": "telegram.chat",
  "id": "123",
  "title": "Saved Messages",
  "type": "private"
}
```

Domains do not call extension RPC methods while serving base domain procedures.
Caller code composes extended views by calling the base procedure, collecting
model markers, reading Extension Registry registrations, calling registered
getter RPC methods through known service URLs, and assembling the view locally.

Infrastructure-level events, extension registrations, and capability
registrations are ephemeral. A domain or module persists its own state when
persistence is part of its own behavior.

## Terms

Module means a trusted internal service that can own storage, expose RPC
methods, publish and consume NATS events, and register capabilities or
extensions.

Slug means the short stable module identifier, for example `summaries`.

Capability means an agent-facing operation exposed by a module or core domain
and collected by Gateway.

Extension means a module-owned getter RPC method registered against a target
model or procedure name.

Target means the string looked up in Extension Registry. For model getters this
is the model marker value, for example `telegram.chat`.

Model marker means `_model` plus the object's stable `id` on the model object
itself.

## Consequences

Benefits:

- Modules can add product value without being loaded into existing domain
  processes.
- Gateway can expose capabilities from core domains and extra modules through
  one agent-facing edge.
- Domains keep ownership of their base models and handlers.
- Callers can compose extra views without changing domain response contracts.
- RPC lifecycle events give modules and operators a common `callId` for live
  follow-up behavior.
- Storage ownership becomes explicit and matches domain and module boundaries.
- Docker Compose remains enough for local and single-host deployments.

Costs:

- Callers that need extension data must compose it explicitly.
- Extension and capability registrations need refresh and stale-entry cleanup.
- TypeScript inference does not make runtime module capabilities statically
  known to every consumer.
- Cross-module behavior depends on naming and registration conventions.
- Service routing remains explicit config until a later discovery layer exists.

Non-goals:

- No hard plugin sandbox.
- No PostgreSQL permission hardening in this decision.
- No Kubernetes requirement.
- No service mesh or dynamic network discovery requirement.
- No persistent infrastructure-level event log.
- No shared internal contracts package for domain RPC contracts.
- No direct browser access to internal module or domain tRPC.

## Operational Defaults

Service URLs remain explicit configuration.

Inside Docker Compose, a module service name should match its slug. A module
with slug `summaries` is addressed as `http://summaries:<port>` inside the
Compose network.

Module tables should use the owning slug as a prefix, for example
`summaries_runs` or `summaries_chat_summaries`.

Extension and capability registrations are refreshed periodically by the owning
module. Gateway and Extension Registry remove stale registrations from their
local registries.

NATS event subjects for a module should use the module slug as their prefix.

The accepted baseline is guarded by `npm run source:audit`, which checks raw
tRPC builder imports, cross-domain schema imports, table-prefix ownership,
Gateway capability behavior, extension boundary rules, and Extension Registry's
non-execution boundary.

## Migration

The original module runtime plan was superseded by
[Extension Registry And Direct RPC Migration](../09-roadmap/extension-registry-direct-rpc-migration.md).
