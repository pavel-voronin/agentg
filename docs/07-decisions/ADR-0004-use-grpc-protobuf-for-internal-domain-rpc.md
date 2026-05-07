# ADR-0004: Use gRPC and Protobuf for Internal Domain RPC

## Status

Superseded by
[ADR-0005: Use Domain-Owned tRPC for Internal RPC](ADR-0005-use-domain-owned-trpc-for-internal-rpc.md).

## Context

AgenTG is moving from package-level and NATS request/reply coupling toward explicit
domain-owned access surfaces.

The system has several internal domains:

- Telegram Client owns TDLib, Telegram session state, Telegram-shaped storage, and
  Telegram API access.
- History owns history templates, targets, coverage, and backfill lifecycle.
- Gateway is the external edge for agents and other external systems.
- Control Plane should have a server-side internal participant when it needs to
  call domain APIs.

Internal services are part of one system and may know each other by stable service
names. The boundary must still be explicit: a domain may depend on another
domain's public contract, but not on its private tables, private code, or raw
third-party objects.

NATS request/reply currently works as an internal RPC mechanism, but it blurs the
event plane and command/read plane. The target architecture needs a stricter
split.

## Decision

Use gRPC with Protobuf schemas for internal domain RPC.

This means:

- Protobuf files define domain service contracts.
- gRPC is the internal transport for addressed commands and reads.
- NATS is the event plane only.
- Gateway remains the external edge and is not the internal orchestrator.
- Large binary payloads are not carried through RPC. RPC returns metadata and
  object-storage locators for files.

`Connect` is not selected as the target architecture. It was considered as a
possible TypeScript-friendly implementation option around Protobuf, but the
architecture decision is plain gRPC plus Protobuf.

HTTP plus JSON is also not selected for internal domain RPC. It is simpler, but it
does not give the project the same contract discipline, streaming option, and
future Go/Rust compatibility.

## Terms

Protobuf is the schema language and wire encoding for messages.

gRPC is the RPC framework. In this project it means internal HTTP/2 RPC endpoints
whose request and response shapes are defined by Protobuf.

NATS is the internal event bus. It should carry facts that happened, not addressed
domain reads or commands.

Object storage is the place for large Telegram media payloads. Domain RPC should
return locators and metadata, not video, audio, or image blobs.

## Consequences

Benefits:

- Domain contracts are explicit and checked by generated code.
- Internal clients depend on stable service APIs instead of package internals.
- Go or Rust services can be added later without redesigning the contract layer.
- Streaming remains possible if a domain later needs it.
- NATS can be kept simple and used for fan-out events.

Costs:

- The repo needs Protobuf files and code generation.
- Each domain service needs an internal gRPC server.
- Local development needs service URL configuration for processes running outside
  Docker.
- Tests must cover generated client/server boundaries, not only direct function
  calls.

Non-goals:

- No enterprise service mesh.
- No dynamic service discovery system.
- No retry orchestration framework.
- No deduplication tables unless a specific domain later proves it needs them.
- No attempt to stream large media through gRPC.

## Operational Defaults

Service discovery is static.

Inside Docker or a future orchestrator, services address each other through
service DNS names such as `telegram` and `history`.

In local development, services receive explicit URLs through environment
variables such as:

- `TELEGRAM_RPC_URL`
- `HISTORY_RPC_URL`

Each service may listen on the same internal container port. Host ports may differ
for local development.

## Minimal RPC Metadata

Every internal RPC call should have a timeout at the client boundary.

Timeout means: the caller will stop waiting after a configured duration and will
handle the call as failed. This protects one stuck service from blocking another
service forever. It does not require building a retry framework.

Every internal RPC call may carry a correlation id.

Correlation id means: a log/debug identifier copied through service calls and
events so a single user action or background cycle can be traced. It is not a
business id and does not imply idempotency by itself.

These are baseline plumbing concerns. They do not require implementing
domain-level retries, cancellation, or deduplication before a domain asks for
them.
