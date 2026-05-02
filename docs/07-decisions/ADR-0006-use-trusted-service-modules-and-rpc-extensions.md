# ADR-0006: Use Trusted Service Modules And RPC Extensions

## Status

Accepted.

## Context

AgenTG has a working internal contour made of domain services, Postgres, NATS,
Gateway, and Control Plane. The first domain boundary work established that
domains should own their internal tRPC APIs and that NATS should carry live
facts rather than addressed commands or reads.

The next layer of product value needs additional modules such as summarization,
classification, search, and higher-order analysis. These modules need to run
inside the trusted contour, store their own state, expose their own operations,
and attach useful results to existing domain reads without changing the owning
domain's model.

The project is a trusted pet-project deployment. The first module runtime should
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

Public internal tRPC methods use a standard AgenTG response envelope. Package
local tRPC runtimes expose these builder names:

- `rpc`
- `observable`
- `enriched`
- `extension`

`rpc` methods return the standard envelope.

`observable` methods return the standard envelope and publish ephemeral call
lifecycle events with a `callId`. Handlers may publish progress through the RPC
context.

`enriched` methods return the standard envelope, publish observable lifecycle
events, and synchronously attach registered extension results under the
`extensions` object.

`extension` methods are module-owned RPC methods registered against an enriched
target. The extension name is both the RPC method name and the key used in the
target response's `extensions` object.

Extension registration is direct and ephemeral. A module registers an extension
with the target service by sending:

```json
{
  "target": "history.getChatHistoryState",
  "extension": "summaries.chatSummary"
}
```

The target service keeps a local in-memory registry, refreshes registrations
through repeated direct RPC registration calls, expires stale entries, and calls
registered extensions in parallel when an enriched target is invoked.

Extension methods receive the full target input and full target output. An
extension result is appended under its extension name. The base result remains
owned by the target domain.

Infrastructure-level events, extension registrations, capability registrations,
and extension call results are ephemeral. A domain or module persists its own
state when persistence is part of its own behavior.

## Terms

Module means a trusted internal service that can own storage, expose RPC
methods, publish and consume NATS events, and register capabilities or
extensions.

Slug means the short stable module identifier, for example `summaries`.

Capability means an agent-facing operation exposed by a module or core domain
and collected by Gateway.

Extension means a module-owned RPC method registered against a target RPC method
so its result can be attached to the target call.

Target means the RPC method being extended, for example
`history.getChatHistoryState`.

Response envelope means the standard successful or domain-error shape returned
by public AgenTG internal RPC methods.

## Consequences

Benefits:

- Modules can add product value without being loaded into existing domain
  processes.
- Gateway can expose capabilities from core domains and extra modules through
  one agent-facing edge.
- Domains keep ownership of their base models and handlers.
- Extensions can enrich selected RPC results without changing the base result.
- Observable calls give modules and operators a common `callId` for live
  follow-up behavior.
- Storage ownership becomes explicit and matches domain and module boundaries.
- Docker Compose remains enough for local and single-host deployments.

Costs:

- Every public internal RPC caller must handle the standard response envelope.
- Domain and module migration ownership requires moving the current centralized
  schema layout.
- Enriched calls add synchronous RPC fan-out and require timeouts.
- Extension and capability registrations need refresh and stale-entry cleanup.
- TypeScript inference does not make runtime module capabilities statically
  known to every consumer.
- Cross-module behavior depends on naming and registration conventions.

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
module. Target services and Gateway remove stale registrations from their local
registries.

Every synchronous extension call should have a short timeout. Extension failure
is represented in the relevant extension envelope.

NATS event subjects for a module should use the module slug as their prefix.

The accepted baseline is guarded by `npm run source:audit`, which checks raw
tRPC builder imports, cross-domain schema imports, table-prefix ownership, and
Gateway capability registry behavior.

## Migration

The staged implementation is tracked in
[Module Runtime And Extensions Plan](../09-roadmap/module-runtime-and-extensions-plan.md).
