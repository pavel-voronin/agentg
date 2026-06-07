# ADR-0006: Use Trusted Service Modules And Internal RPC

## Status

Accepted. Updated by the Registry migration.

## Context

AgenTG has a working internal contour made of domain services, Postgres, NATS,
Gateway, and Control Plane. Domains own their module RPC APIs and storage. NATS
carries live facts rather than addressed commands or reads.

The next layer of product value needs additional modules such as summarization,
classification, search, and higher-order analysis. These modules need to run
inside the trusted contour, store their own state, expose their own operations,
and publish facts without moving that ownership into existing domains.

The project is a trusted pet-project deployment. The module runtime should
optimize for simple ownership, explicit contracts, and local development rather
than hard isolation.

## Decision

Use trusted internal services as the module unit.

Each module is an independent service with a stable module name. The module name
is used for service addressing, NATS subjects, table prefixes, and logs.

Each domain and module owns its storage schema and migrations. The shared
database package provides database infrastructure, not one centralized domain
schema. Domains and modules write only their owned tables by convention.

Gateway exposes agent-facing RPC methods directly. Modules do not register
capabilities with Gateway, and Gateway does not keep a capability registry.

Internal module RPC procedures return direct result bodies.

RPC lifecycle events are published by default. Callers can pass:

- `observable: false` to suppress lifecycle events for the current call.
- `silent: true` to suppress lifecycle events and synchronous fact events
  published by the current handler.

Registry owns service discovery and procedure routing metadata. Each service
joins with a manifest:

```json
{
  "module": "analysis",
  "rpcUrl": "http://analysis:8080",
  "required": false,
  "procedures": ["analysis.requestReport", "analysis.chatInsights"]
}
```

Registry returns a versioned snapshot. Framework clients keep the snapshot
locally and refresh it only through explicit `getSnapshot` calls. Registry does
not call domain or module RPC methods.

Manifest `required` is a runtime invariant flag. Loss of a previously seen
`required: true` service is fatal for every Registry client. Loss of a
`required: false` service removes its procedures from the snapshot.

Infrastructure-level events are ephemeral. A domain or module persists its own
state when persistence is part of its own behavior.

## Terms

Module means a trusted internal service that can own storage, expose RPC
methods, and publish or consume NATS events.

Module name means the short stable module identifier, for example `analysis`.

Procedure means an internal module RPC method published through the module's
Registry manifest.

## Consequences

Benefits:

- Modules can add product value without being loaded into existing domain
  processes.
- Gateway keeps one explicit agent-facing edge without module-side registration.
- Domains keep ownership of their base models and handlers.
- RPC lifecycle events give modules and operators a common `callId` for live
  follow-up behavior.
- Storage ownership becomes explicit and matches domain and module boundaries.
- Docker Compose remains enough for local and single-host deployments.

Costs:

- Cross-module reads depend on procedure naming and Registry routing.
- Service routing depends on live Registry snapshots.
- Product views that combine multiple owners must be explicit procedures or
  Control Plane composition owned by the appropriate boundary.

Non-goals:

- No hard plugin sandbox.
- No PostgreSQL permission hardening in this decision.
- No Kubernetes requirement.
- No service mesh or dynamic network discovery requirement.
- No persistent infrastructure-level event log.
- No shared internal contracts package for domain RPC contracts.
- No direct browser access to internal module or domain module RPC.

## Operational Defaults

Services know Registry URL, NATS URL, their own service URL, and their own
manifest. Cross-service topology is read from the local Registry snapshot.

Core services register as required: Telegram ingestion, History Sync, Gateway,
and Control Plane. Trusted modules that add optional product behavior register
as not required unless their absence must stop the whole runtime.

Service startup order is managed outside Registry. Local development uses
Process Compose for product processes and Docker Compose for infrastructure
dependencies. A service joins Registry only after its startup dependencies are
ready.

## Source Audit

`npm run source:audit` guards naming, domain boundary, table ownership,
Gateway external surface, and Registry isolation rules.

## Current Documentation

Runtime details are documented in
[Module Runtime](../02-architecture/moduleRuntime.md).
