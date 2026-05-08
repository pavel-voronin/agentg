# Domain Boundary Hardening Plan

This plan fixes the current domain-boundary audit findings after the internal
tRPC migration work.

Parent context:

- [Internal Domain tRPC Migration](internal-domain-trpc-migration.md)
- [Component Boundaries](../02-architecture/component-boundaries.md)
- [Event Plane](../05-interfaces/event-plane.md)

## Findings

The audit found three boundary issues:

1. Gateway owns external `telegram.*` WebSocket methods, but the implementation
   reads Telegram tables directly and returns database rows, including raw
   Telegram JSON, to external clients.
2. History owns history reads, targets, coverage, and jobs, but its
   observability read model reads Telegram storage tables directly and parses
   Telegram raw JSON fields for chat list behavior.
3. Control Plane owns the browser-facing UI model, but several history-facing
   browser types are loose `unknown` shapes instead of explicit Control
   Plane-owned models.

## Stage Goal

Make every external, browser-facing, and cross-domain read pass through an
owning domain model instead of leaking storage rows, raw Telegram payloads, or
untyped ingress shapes.

## Implementation Choices

- Keep Gateway's external WebSocket protocol and `telegram.*` method names
  stable.
- Keep Control Plane's browser-facing WebSocket envelope stable. Browser reads
  use domain-owned procedure names and Control Plane server only proxies them.
- Keep the current Telegram History tRPC procedures used by History stable.
- Add Telegram-owned read models for Telegram chat and message reads instead of
  letting Gateway or History read Telegram tables directly.
- Use Telegram tRPC for Telegram-owned read data, even when the backing data is
  still stored in Postgres.
- Keep History as the only owner of history targets, coverage, backfill
  jobs, and History-owned stats.
- Let Control Plane compose browser chat lists from Telegram-owned chat
  directory data plus History-owned stats.
- Let History compose selected history state from its own tables plus
  stable Telegram-owned read models.
- Do not expose raw TDLib objects, Telegram raw JSON, or Drizzle row shapes from
  Gateway, History, or Control Plane browser models.
- Prefer narrow DTOs and mappers at every edge over returning full database
  records.
- Use explicit input and output validation for every new public internal tRPC
  procedure.

## Concrete Scope

- Add Telegram-owned tRPC read procedures for Gateway's existing `telegram.*`
  read surface.
- Change Gateway to call Telegram through a Telegram-owned client instead of
  importing Telegram database schema tables.
- Add Telegram-owned read procedures that give History the chat directory
  and message-count facts it currently derives from Telegram storage tables.
- Remove History chat-directory browser reads. History exposes stats
  keyed by `telegramChatId`; Control Plane owns the browser chat list read
  model.
- Replace loose Control Plane history UI types with explicit browser-facing
  models and adapters.
- Update interface and architecture documentation to reflect the new recovery
  and read surfaces.
- Add source audits and tests that prevent the same leaks from returning.

## Explicit Non-Scope

- Do not change Gateway's external WebSocket request or response envelope.
- Do not rename existing Gateway `telegram.*` or `history.*` methods.
- Do not let browser code call internal Telegram or History tRPC directly.
- Do not expose Telegram chat directory, folders, or navigation through
  `history.*` methods.
- Do not introduce a shared internal contracts package.
- Do not move History target, coverage, or backfill job ownership out of History
  Sync.
- Do not redesign Telegram storage tables.
- Do not remove raw Telegram storage from Postgres.
- Do not change the event envelope or NATS subjects except for documentation if
  needed.
- Do not add attachment payload transport.

## Stage 1: Gateway Telegram Read Boundary

Purpose: stop external agent ingress from seeing Telegram storage rows or raw
Telegram payloads.

### Scope

- Define Telegram-owned input and output schemas for:
  - `telegram.getChat`
  - `telegram.getMessage`
  - `telegram.listRecentMessages`
  - `telegram.searchMessages`
- Add a Telegram read tRPC router inside `@agentg/telegram`.
- Keep the existing Telegram History tRPC procedures available at the same URL
  so History keeps working during the stage.
- Return compact Telegram read DTOs:
  - chat: `id`, `title`, `type`, `updatedAt`
  - message: `_model: "telegram.message"`, `id`, `chat`, `telegramMessageId`,
    `sender`, `senderType`, `contentType`, `text`, `messageDate`, `editDate`,
    `isDeleted`, `deletedAt`, `updatedAt`
- Exclude `raw`, TDLib `_` fields, database primary key internals, and Drizzle
  row shapes from all Gateway-visible Telegram read results.
- Add a Gateway-owned JSON-RPC adapter that maps existing `telegram.*` method
  names to the Telegram read tRPC client.
- Remove Gateway direct imports of `@agentg/database/schema`,
  `@agentg/database/client`, and Drizzle query helpers when they are no longer
  needed.
- Remove Gateway runtime database configuration if Gateway has no remaining
  direct database reads.
- Update Gateway tests to prove `telegram.*` responses contain the stable DTO
  shape and do not contain `raw`.

### Definition of Done

- Gateway `telegram.*` methods are still available with the current method
  names.
- Gateway no longer imports Telegram tables or Drizzle query helpers.
- Gateway does not return `raw` Telegram JSON in `telegram.*` responses.
- Telegram owns the schemas, router, handlers, and tests for Telegram read
  procedures.
- Existing History calls to Telegram History tRPC still pass unchanged.
- Existing `npm run check` passes.

### Stop Rule

After Stage 1 is done, stop. Stage 2 changes History read composition and
must be reviewed separately because it affects operator-facing history views.

## Stage 2: History Telegram Read Dependency

Purpose: stop History from parsing Telegram storage rows and raw Telegram
JSON while keeping History in charge of history aggregation.

### Scope

- Add Telegram-owned read procedures for the facts History currently reads
  from Telegram storage:
  - chat directory entries with stable list placement and sort fields
  - chat folders
  - chat detail by `chatId`
  - total persisted message count for a chat
  - earliest persisted message date for a chat
  - message counts for requested chat intervals
- Model Telegram chat placement explicitly instead of exposing raw
  `chat.raw.positions`:
  - `kind: "main" | "archive" | "folder"`
  - `folderId` only for folder placement
  - `order`
  - `lastMessageDate`
- Keep Telegram-owned DTOs free of raw TDLib payloads.
- Introduce a History-side Telegram read client interface so
  `history.getChatHistoryState` can be tested without Telegram storage tables.
- Remove the History chat-list RPC.
- Add History `history.getChatStats`:
  - accept explicit `chatIds`
  - return only History-owned target, coverage, pending job, and running job
    counters keyed by `chatId`
  - return no Telegram title, folder, navigation, placement, or type data
- Keep Control Plane server as a browser WebSocket proxy for domain RPC.
- Move Control Plane browser composition into domain-provided slot content:
  - Telegram content owns chat directory state and calls
    `telegram.listChatDirectory`.
  - History content owns chat stats, selected history state, targets, jobs, and
    timeline state through `history.*` procedures.
- Change History `history.getChatHistoryState` to get selected chat
  metadata, message count, earliest message date, and interval message counts
  through Telegram read procedures.
- Remove direct reads of `telegramChats`, `telegramMessages`,
  `telegramUsers`, and `telegramChatFolders` from `packages/history/src`.
- Keep History direct writes and reads for `historyTemplates`,
  `historyTargets`, `historyCoverage`, and `historyBackfillJobs`.
- Update tests to use fake Telegram read clients for History observability
  paths.

### Definition of Done

- `packages/history/src` no longer imports or queries Telegram storage
  tables.
- History still owns and validates the `history.*` output models.
- History still owns target writes, coverage writes, backfill job state,
  reconciliation, and sync lifecycle events.
- History does not expose a chat-list RPC.
- Telegram control-plane content owns chat list filtering for main, archive, and
  folder placement without raw Telegram JSON fixtures.
- Tests cover selected chat history state message counts without direct
  `telegramMessages` access.
- Existing `npm run check` passes.

### Stop Rule

After Stage 2 is done, stop. Stage 3 is a Control Plane browser model cleanup
and should not be mixed with server-side domain rewiring.

## Stage 3: Control Plane Browser Models

Purpose: move domain-specific Control Plane browser models into the domains that
provide the corresponding slot content. Control Plane keeps only shell, layout,
event stream, and WebSocket proxy state.

### Scope

- Move Telegram chat directory view models and state into Telegram
  control-plane content.
- Move History dashboard, selected history, target, and timeline view models and
  state into History control-plane content.
- Keep Control Plane browser code aware of domain procedure names only through
  the generic Control Plane WebSocket proxy.
- Keep generic event `data` typed as JSON or `unknown` only where the event
  envelope is intentionally generic.
- Keep event panel grouping mechanical, based on observed event type prefixes
  and RPC call lifecycle metadata.
- Add or update tests for moved domain reducers and slot composition.

### Definition of Done

- Control Plane no longer has Telegram or History view-model stores.
- Domain-provided slot content owns browser-facing models and does not expose raw
  Telegram payloads or database rows.
- History timeline reducer tests live with the History domain.
- Existing `npm run check` passes.

### Stop Rule

After Stage 3 is done, stop. Any broader UI protocol redesign or direct typed
schema sharing with the browser needs a separate plan.

## Stage 4: Documentation And Audit

Purpose: make the new boundary state explicit and prevent regressions.

### Scope

- Update `docs/05-interfaces/agent-gateway-api.md` so Gateway Telegram reads are
  documented as Gateway WebSocket methods backed by Telegram-owned internal
  tRPC, not direct Postgres row reads.
- Update `docs/05-interfaces/event-plane.md` recovery surfaces to distinguish:
  - Gateway external clients recovering through Gateway WebSocket RPC backed by
    Telegram and History internal tRPC
  - Control Plane browser clients recovering through Control Plane WebSocket RPC
    backed by History internal tRPC
  - History recovering through its own history tables plus Telegram read and
    history-fetch tRPC
- Update `docs/02-architecture/component-boundaries.md` to state that History
  Sync may compose history reads from Telegram-owned read models, but must not
  parse Telegram raw storage.
- Add a short source-audit section to the relevant plan or event-plane document.
- Run source audits:
  - Gateway source has no direct Telegram table imports.
  - History source has no direct Telegram table imports.
  - Gateway Telegram responses have tests proving `raw` is absent.
  - Control Plane history models have no `unknown[]` or open index signature for
    known History state.
- Run the full repository check.

### Definition of Done

- Documentation matches the implemented read paths.
- Audit commands are recorded with the final result.
- No direct cross-domain storage reads remain for Gateway Telegram reads or
  History observability reads.
- No known History UI response section is modeled as `unknown[]`.
- Existing `npm run check` passes.

## Validation Checklist

- `rg -n "@agentg/database/(schema|client)|drizzle-orm" packages/gateway/src`
  returns no direct database usage unless a new Gateway-owned storage need was
  explicitly introduced.
- `rg -n "telegramChats|telegramMessages|telegramUsers|telegramChatFolders" packages/history/src`
  returns no runtime source matches.
- `rg -n "raw" packages/gateway/src packages/control-plane/src` has no Gateway
  Telegram response leak and no Control Plane history model leak.
- `rg -n "unknown\\[\\]|\\[key: string\\]: unknown" packages/control-plane/src`
  has no matches for known History state models.
- `npm run check` passes.

## Implementation Audit Result

The implementation was validated with these source audits:

- `rg -n "@agentg/database/(schema|client)|drizzle-orm|telegramChats|telegramMessages" packages/gateway/src`
  returned no matches.
- `rg -n "telegramChats|telegramMessages|telegramUsers|telegramChatFolders|chat\\.raw|raw\\.positions" packages/history/src`
  returned no matches.
- `rg -n "unknown\\[\\]|\\[key: string\\]: unknown" packages/control-plane/src`
  returned no matches.
- `rg -n "raw" packages/gateway/src packages/control-plane/src` only returned
  generic WebSocket payload conversion, local storage parsing, and timeline
  helper names; it did not find Gateway Telegram response leaks or Control Plane
  history model leaks.

The final repository validation command `npm run check` passed.

## Final Definition of Done

- Gateway external ingress no longer exposes Telegram storage rows or raw
  Telegram payloads.
- Telegram owns Telegram read models and validates their internal tRPC inputs
  and outputs.
- History no longer reads or parses Telegram storage tables directly.
- History composes History-owned read DTOs from History storage plus
  Telegram-owned read DTOs.
- Domain-provided Control Plane content owns its browser-facing models for known
  History and Telegram response shapes.
- Gateway external protocol remains stable. Control Plane browser chat-list
  reads use `telegram.*` and `history.*` through the Control Plane WebSocket
  proxy.
- No shared internal contracts package is introduced.
- The documentation and source audits agree with the implemented boundaries.
