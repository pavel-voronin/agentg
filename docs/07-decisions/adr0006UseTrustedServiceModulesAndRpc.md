# ADR-0006: Use Trusted Service Modules And Internal RPC

## Status

Accepted. Updated by the static typed client migration.

## Context

AgenTG has a working internal contour made of domain services, Postgres, NATS,
Gateway, and Dashboard. Domains own their module RPC APIs and storage. NATS
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
capabilities with Gateway, and Gateway does not keep a capability catalog.

Internal module RPC procedures return direct result bodies. A module declares its
procedure surface by returning a procedure map directly from `setup()`. The
framework uses that instance-level map to start the module RPC server; the
runtime app exposes only `start()` and `stop()`.

Cross-module callers use package-owned typed RPC clients. A serving package
exports a client from its root only when another package currently consumes that
module:

```ts
import { telegramClient } from '@agentg/telegram';

const telegram = telegramClient({ url: config.telegramRpcUrl });
```

Process Compose, Docker Compose, or the production supervisor owns startup
ordering and service addresses. Failure of a dependency is represented as an
RPC call failure or service process failure, not as discovery snapshot state.

Infrastructure-level events are ephemeral. A domain or module persists its own
state when persistence is part of its own behavior.

## Terms

Module means a trusted internal service that can own storage, expose RPC
methods, and publish or consume NATS events.

Module name means the short stable module identifier, for example `analysis`.

Procedure means an internal module RPC method exposed by the module runtime and
called through the serving package's typed client.

## Consequences

Benefits:

- Modules can add product value without being loaded into existing domain
  processes.
- Gateway keeps one explicit agent-facing edge without module-side registration.
- Domains keep ownership of their base models and handlers.
- RPC telemetry gives modules and operators a common view of internal procedure
  latency and failures.
- Storage ownership becomes explicit and matches domain and module boundaries.
- Docker Compose remains enough for local and single-host deployments.

Costs:

- Cross-module reads depend on configured service URLs and the serving
  package's typed client export.
- Runtime service availability is managed by the process or container
  supervisor instead of a project-owned discovery server.
- Product views that combine multiple owners must be explicit procedures or
  Dashboard composition owned by the appropriate boundary.

Non-goals:

- No hard plugin sandbox.
- No PostgreSQL permission hardening in this decision.
- No Kubernetes requirement.
- No service mesh or dynamic network discovery requirement.
- No persistent infrastructure-level event log.
- No shared internal contracts package for domain RPC contracts.
- No direct browser access to internal module or domain module RPC.

## Operational Defaults

Services know NATS URL, their own bind address, and explicit RPC URLs for the
internal services they consume.

Core service order is explicit in Process Compose and Docker Compose. RPC
consumers start after the consumed service is healthy: Telegram is healthy
before History Sync and Gateway, and Telegram plus History Sync are healthy
before Dashboard server. Dashboard does not depend on Gateway. Trusted modules
that add product behavior use the same supervisor-owned ordering and address
model.

Local development uses Process Compose for product processes and Docker Compose
for infrastructure dependencies.

## Source Audit

`npm run source:audit` guards naming, domain boundary, table ownership, Gateway
external surface, and Dashboard frontend procedure-call boundaries.

## Current Documentation

Runtime details are documented in
[Module Runtime](../02-architecture/moduleRuntime.md).
