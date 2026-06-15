# Telegram Module Architecture

## Purpose

Telegram owns the product capability for reading, ingesting, reconciling, and
displaying Telegram data. TDLib and Postgres are implementation boundaries, not
the language used by the center of the module.

The module invariant is:

```text
TDLib input
 -> adapter
 -> domain changes / domain models
 -> application services
 -> repositories
 -> storage
```

The reverse read path is:

```text
storage row
 -> repository
 -> domain model
 -> procedure / event / dashboard
```

## Goals

- Keep TDLib private to Telegram boundary code.
- Keep Drizzle private to storage boundary code.
- Make domain models the common language for ingestion, repositories,
  procedures, events, and Dashboard.
- Keep `telegram.getMessages` a product capability that returns ready domain
  messages or a pending domain request.
- Make Dashboard live from domain events and user-intent procedure calls.
- Remove replaced names, raw events, and parallel old/new paths as soon as a
  target path exists.

## Non-Goals

- Do not expose TDLib operation names, TDLib cursors, storage rows, coverage
  internals, or worker strategy in public procedure contracts.
- Do not introduce compatibility envelopes, fallback paths, or duplicate
  architecture.
- Do not add a generic platform layer inside Telegram.
- Do not export private domain types through the package root for future use.
- Do not make file download completion part of default message history
  readiness.

## Ubiquitous Language

- `Message`: Telegram domain message used by procedures, events, repositories,
  application services, and Dashboard payloads.
- `Chat`: Telegram domain chat used by procedures, events, repositories, and
  Dashboard payloads.
- `FileRef`: Telegram domain reference to a file asset owned by a domain model.
- `DomainChange`: an internal change produced by adapters from external input.
- `ApplicationService`: orchestration that applies domain changes through
  repositories and publishes domain events.
- `Repository`: domain-facing port that accepts and returns domain models.
- `Storage`: Drizzle-backed persistence implementation.
- `Adapter`: parser that converts TDLib shapes into domain models or domain
  changes.

Names such as `ReadMessage` and `ReadChat` are not target architecture names.
The locally readable form is still the domain `Message` or `Chat`.

## Boundary Contract

### TDLib Boundary

Production imports from `tdlib-types` are allowed only in these folders:

```text
packages/telegram/src/tdlib/
packages/telegram/src/ingestion/adapters/
packages/telegram/src/reconciler/adapters/
```

Code outside those folders must not see TDLib constructor names, TDLib `_`
fields, TDLib payload shapes, TDLib pagination mechanics, or raw TDLib content.

Adapters parse TDLib payloads once:

```ts
tdlib update -> DomainChange[]
tdlib message -> Message
tdlib chat -> Chat
tdlib file -> FileRef
```

When one TDLib update contains multiple nested entities, the adapter returns
multiple domain changes. Handlers and services process domain changes; they do
not inspect the original TDLib object.

### Domain Boundary

Domain models live under:

```text
packages/telegram/src/domain/models/
packages/telegram/src/domain/changes.ts
packages/telegram/src/domain/events.ts
```

Domain files must not import Drizzle, storage schema, `tdlib-types`, TDLib
client code, Dashboard components, or procedure DTOs.

Domain models describe Telegram product data, not storage tables and not TDLib
objects. They can contain stable Telegram identifiers such as chat id and
message id when those identifiers are part of the product model.

### Application Service Boundary

Application services accept `DomainChange[]` and apply them through
repositories:

```text
DomainChange[]
 -> save Message
 -> save Chat
 -> save FileRef
 -> publish domain event
```

Application services do not import Drizzle tables or TDLib types.

### Repository Boundary

Repositories accept and return domain models:

```ts
messageRepository.save(message: Message)
messageRepository.find(input) -> Message[]
chatRepository.save(chat: Chat)
fileRepository.save(file: FileRef)
```

A repository may depend on storage implementations. It must not expose storage
rows, Drizzle `$inferSelect`, Drizzle `$inferInsert`, or TDLib payloads to its
callers.

### Storage Boundary

Storage owns Drizzle, table definitions, SQL, indexes, migrations, and row
types. Storage code lives under:

```text
packages/telegram/src/storage/
packages/telegram/drizzle/
```

Storage does not publish events. Storage does not return rows directly to
procedures, events, Dashboard, or domain models.

### Event Boundary

Telegram events are domain events. Event payloads import domain models instead
of redefining message or chat shapes.

Allowed message-history events include:

```text
telegram.message.created
telegram.message.updated
telegram.message.deleted
telegram.messages.ready
telegram.history.job.updated
```

Raw TDLib update events, proxy events, and events whose payload is a TDLib
shape are outside the target architecture.

### Procedure Boundary

Procedures expose product capabilities. `telegram.getMessages` accepts a domain
owner and domain selector, then returns one of:

```text
ready Message[]
pending request id
```

It must not expose TDLib operation selection, storage rows, coverage tables,
worker queues, or materialization strategy. Readiness remains Telegram-owned:
callers only learn whether data is ready or whether a request is pending.

### Dashboard Boundary

Dashboard calls procedures during initialization or in response to clear user
intent. A user-created request id may continue across the asynchronous workflow:
when a matching domain event arrives, Dashboard may make the exact follow-up
procedure call required to read that same request result.

Dashboard must not poll, broadly refresh on events, or call domain procedures
from timers and lifecycle hooks after initialization.

## Target File Structure

```text
packages/telegram/src/
  tdlib/
    client.ts
    fileOperations.ts
    fileSnapshot.ts
    messageState.ts
    shape.ts

  domain/
    AGENTS.md
    models/
      AGENTS.md
      message.ts
      messageSelection.ts
      messageText.ts
      chat.ts
      chatDirectory.ts
      chatPlacement.ts
      chatState.ts
      fileRef.ts
    changes.ts
    events.ts

  ingestion/
    adapters/
      AGENTS.md
      catalog.ts
      message.ts
      messageText.ts
      operations.ts
      updateTypes.ts
      update-handlers/
        updateNewMessage.ts

  application/
    AGENTS.md
    applyChanges.ts

  repositories/
    AGENTS.md
    chatDirectoryRepository.ts
    messageRepository.ts
    messageAssembler.ts
    messageReadinessRepository.ts
    chatRepository.ts
    fileRepository.ts

  storage/
    AGENTS.md
    messageReadStorage.ts
    messageRowStorage.ts
    messageStorage.ts
    chatStorage.ts
    fileStorage.ts
    chatDirectoryStorage.ts
    historyCoverageStorage.ts
    historySourceStorage.ts
    reconcilerCoverageStorage.ts
    reconcilerJobStorage.ts

  reconciler/
    adapters/
      AGENTS.md
      historyPage.ts
      historySource.ts
    runtime.ts

  procedures/
    get-messages/
      contract.ts
      enqueue.ts
      procedure.ts
      requestId.ts

  dashboard/
```

Names may be narrowed during implementation when the responsibility is clearer,
but adapter, domain, application service, repository, and storage must remain
separate layers.

Every new folder under `packages/telegram` needs its own `AGENTS.md` before code
is added there.

## Test Contract

- Boundary tests assert that production `tdlib-types` imports exist only under
  the TDLib boundary and adapter folders.
- Boundary tests assert that Drizzle imports and schema imports do not appear
  in domain, application, procedure, event, repository caller, or Dashboard
  frontend code.
- Adapter tests cover nested TDLib updates producing multiple domain changes.
- Repository tests verify row-to-domain and domain-to-row mapping.
- Procedure tests verify ready and pending `getMessages` behavior using domain
  `Message[]`.
- Event tests verify `telegram.messages.ready` and message events carry domain
  payloads.
- Dashboard tests verify no background procedure calls after initialization
  without a stored user request id.

## Observability Contract

Metrics and logs may report domain lifecycle outcomes such as adapter result,
domain change kind, repository write result, history job status, and request
completion status.

Metrics must not use high-cardinality labels such as request id, chat id,
message id, raw timestamp, raw date range, TDLib cursor, or storage row key.

## Implementation Sequence

1. Keep this document as the target source of truth.
2. Keep one active execution plan in repository-root `PLAN.md`.
3. Introduce domain models without behavior changes.
4. Introduce TDLib adapters for message, chat, file, and update changes.
5. Move message write path to `TDLib -> adapter -> DomainChange -> repository`.
6. Move read path to `storage -> repository -> domain model`.
7. Rename `ReadMessage` and `ReadChat` target names to `Message` and `Chat`.
8. Remove raw TDLib events and proxy events.
9. Move `getMessages` onto the domain model.
10. Move Dashboard consumers onto domain events and user-intent follow-up calls.
11. Remove replaced code and obsolete names.
12. Run `npm run check:telegram`; run `npm run check` before final integration.

## Removal Notes

- No compatibility envelope may survive the rewrite.
- No second message assembly path may survive the rewrite.
- No old `ReadMessage` or `ReadChat` domain names may survive the rewrite.
- No raw TDLib event or TDLib-shaped event payload may survive the rewrite.
