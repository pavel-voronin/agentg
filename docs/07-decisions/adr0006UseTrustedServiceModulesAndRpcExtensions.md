# ADR-0006: Use Trusted Service Modules And RPC Extensions

## Status

Accepted. Updated by the Service Directory migration.

## Context

AgenTG has a working internal contour made of domain services, Postgres, NATS,
Gateway, and Control Plane. Domains own their module RPC APIs and storage. NATS carries
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
service addressing, NATS subjects, table prefixes, logs, and extension names.

Each domain and module owns its storage schema and migrations. The shared
database package provides database infrastructure, not one centralized domain
schema. Domains and modules write only their owned tables by convention.

Gateway exposes agent-facing RPC methods directly. Modules do not register
capabilities with Gateway, and Gateway does not keep a capability registry.

Internal module RPC procedures return direct result bodies. Model objects that callers
can extend mark themselves inline with `_model` and their existing `id`.

RPC lifecycle events are published by default. Callers can pass:

- `observable: false` to suppress lifecycle events for the current call.
- `silent: true` to suppress lifecycle events and synchronous fact events
  published by the current handler.

Service Directory owns service discovery and extension declarations. Each
service joins with a manifest:

```json
{
  "slug": "analysis",
  "rpcUrl": "http://analysis:8080",
  "required": false,
  "procedures": ["analysis.requestReport", "analysis.chatInsights"],
  "events": ["analysis.report.completed"],
  "extensions": [
    {
      "target": "telegram.chat",
      "extension": "analysis.chatInsights"
    }
  ]
}
```

Service Directory returns a lease and a versioned snapshot. Services renew
leases, subscribe to `service_directory.changed`, and pull a fresh snapshot when
their local version is stale. Service Directory does not call domain or module
RPC methods.

Manifest `required` is a runtime invariant flag. Loss of a previously seen
`required: true` service is fatal for every Service Directory client. Loss of a
`required: false` service only removes its procedures and extensions from the
snapshot.

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
model markers, reading the local Service Directory snapshot, calling registered
getter RPC methods through the owning service URL, and assembling the view
locally.

Infrastructure-level events and Service Directory leases are ephemeral. A domain
or module persists its own state when persistence is part of its own behavior.

## Terms

Module means a trusted internal service that can own storage, expose RPC
methods, publish and consume NATS events, and register extensions.

Slug means the short stable module identifier, for example `analysis`.

Extension means a module-owned getter RPC method registered against a target
model or procedure name.

Target means the string looked up in the Service Directory snapshot. For model
getters this is the model marker value, for example `telegram.chat`.

Model marker means `_model` plus the object's stable `id` on the model object
itself.

## Consequences

Benefits:

- Modules can add product value without being loaded into existing domain
  processes.
- Gateway keeps one explicit agent-facing edge without module-side registration.
- Domains keep ownership of their base models and handlers.
- Callers can compose extra views without changing domain response contracts.
- RPC lifecycle events give modules and operators a common `callId` for live
  follow-up behavior.
- Storage ownership becomes explicit and matches domain and module boundaries.
- Docker Compose remains enough for local and single-host deployments.

Costs:

- Callers that need extension data must compose it explicitly.
- Service Directory leases need renewal and stale-entry cleanup.
- Cross-module behavior depends on naming and registration conventions.
- Service routing depends on live Service Directory snapshots.

Non-goals:

- No hard plugin sandbox.
- No PostgreSQL permission hardening in this decision.
- No Kubernetes requirement.
- No service mesh or dynamic network discovery requirement.
- No persistent infrastructure-level event log.
- No shared internal contracts package for domain RPC contracts.
- No direct browser access to internal module or domain module RPC.

## Operational Defaults

Services know Service Directory URL, NATS URL, their own service URL, and their
own manifest. Cross-service topology is read from the local Service Directory
snapshot.

Core services register as required: Telegram ingestion, History Sync, Gateway,
and Control Plane. Trusted modules that add optional product views register as
not required unless their absence must stop the whole runtime.

Inside Docker Compose, a module service name should match its slug. A module
with slug `analysis` is addressed as `http://analysis:<port>` inside the
Compose network.

Module tables should use the owning slug as a prefix, for example
`analysis_runs` or `analysis_chat_insights`.

Services renew their Service Directory lease periodically. Service Directory
removes stale services and their extension declarations from its snapshot.

NATS event subjects for a module should use the module slug as their prefix.

The accepted baseline is guarded by `npm run source:audit`, which checks raw
module RPC builder imports, cross-domain schema imports, table-prefix ownership,
Gateway external surface, extension boundary rules, and Service Directory's
non-execution boundary.

## Migration

The current module/discovery architecture is described by
[Module Runtime And Extensions](../02-architecture/moduleRuntimeAndExtensions.md).
