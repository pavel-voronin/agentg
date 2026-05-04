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
2. History Sync owns history reads, targets, coverage, and jobs, but its
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
- Keep Control Plane's browser-facing WebSocket envelope stable. Browser read
  methods that compose cross-domain UI models are `controlPlane.*` methods.
- Keep the current Telegram History tRPC procedures used by History Sync stable.
- Add Telegram-owned read models for Telegram chat and message reads instead of
  letting Gateway or History Sync read Telegram tables directly.
- Use Telegram tRPC for Telegram-owned read data, even when the backing data is
  still stored in Postgres.
- Keep History Sync as the only owner of history targets, coverage, backfill
  jobs, and History-owned stats.
- Let Control Plane compose browser chat lists from Telegram-owned chat
  directory data plus History-owned stats.
- Let History Sync compose selected history state from its own tables plus
  stable Telegram-owned read models.
- Do not expose raw TDLib objects, Telegram raw JSON, or Drizzle row shapes from
  Gateway, History Sync, or Control Plane browser models.
- Prefer narrow DTOs and mappers at every edge over returning full database
  records.
- Use explicit input and output validation for every new public internal tRPC
  procedure.

## Concrete Scope

- Add Telegram-owned tRPC read procedures for Gateway's existing `telegram.*`
  read surface.
- Change Gateway to call Telegram through a Telegram-owned client instead of
  importing Telegram database schema tables.
- Add Telegram-owned read procedures that give History Sync the chat directory
  and message-count facts it currently derives from Telegram storage tables.
- Remove History Sync chat-directory browser reads. History Sync exposes stats
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
  so History Sync keeps working during the stage.
- Return compact Telegram read DTOs:
  - chat: `id`, `title`, `type`, `updatedAt`
  - message: `chatId`, `messageId`, `senderId`, `senderType`, `contentType`,
    `text`, `messageDate`, `editDate`, `isDeleted`, `deletedAt`, `updatedAt`
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
- Existing History Sync calls to Telegram History tRPC still pass unchanged.
- Existing `npm run check` passes.

### Stop Rule

After Stage 1 is done, stop. Stage 2 changes History Sync read composition and
must be reviewed separately because it affects operator-facing history views.

## Stage 2: History Sync Telegram Read Dependency

Purpose: stop History Sync from parsing Telegram storage rows and raw Telegram
JSON while keeping History Sync in charge of history aggregation.

### Scope

- Add Telegram-owned read procedures for the facts History Sync currently reads
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
- Introduce a History Sync-side Telegram read client interface so
  `history.getChatHistoryState` can be tested without Telegram storage tables.
- Remove the History Sync chat-list RPC.
- Add History Sync `history.getChatStats`:
  - accept explicit `chatIds`
  - return only History-owned target, coverage, pending job, and running job
    counters keyed by `chatId`
  - return no Telegram title, folder, navigation, placement, or type data
- Keep `history.getOverview` limited to History-owned template, target,
  coverage, and job counters.
- Add Control Plane read methods:
  - `controlPlane.getOverview` composes Telegram chat count with
    `history.getOverview`
  - `controlPlane.listChats` composes `telegram.listChatDirectory` with
    `history.getChatStats`
- Change History Sync `history.getChatHistoryState` to get selected chat
  metadata, message count, earliest message date, and interval message counts
  through Telegram read procedures.
- Remove direct reads of `telegramChats`, `telegramMessages`,
  `telegramUsers`, and `telegramChatFolders` from `packages/history-sync/src`.
- Keep History Sync direct writes and reads for `historyTemplates`,
  `historyTargets`, `historyCoverage`, and `historyBackfillJobs`.
- Update tests to use fake Telegram read clients for History observability
  paths.

### Definition of Done

- `packages/history-sync/src` no longer imports or queries Telegram storage
  tables.
- History Sync still owns and validates the `history.*` output models.
- History Sync still owns target writes, coverage writes, backfill job state,
  reconciliation, and sync lifecycle events.
- History Sync does not expose a chat-list RPC.
- `history.getOverview` does not return chat counts.
- `controlPlane.listChats` owns chat list filtering for main, archive, and
  folder placement without raw Telegram JSON fixtures.
- Tests cover selected chat history state message counts without direct
  `telegramMessages` access.
- Existing `npm run check` passes.

### Stop Rule

After Stage 2 is done, stop. Stage 3 is a Control Plane browser model cleanup
and should not be mixed with server-side domain rewiring.

## Stage 3: Control Plane Browser Models

Purpose: make Control Plane own explicit browser-facing models instead of
letting untyped history ingress flow through stores and view models.

### Scope

- Replace loose History UI types in `controlPlaneTypes.ts` with explicit models:
  - `HistoryOverview`
  - `HistoryActiveJob`
  - `ControlPlaneChat`
  - `ChatNavigation`
  - `HistoryInterval`
  - `HistoryJob`
  - `HistoryBoundary`
  - `HistoryRange`
  - `HistoryTarget`
  - `SelectedHistoryChat`
  - `SelectedHistoryState`
  - `HistoryChatTypeCount`
- Remove `coverage?: unknown[]`, `jobs?: unknown[]`, `targets?: unknown[]`,
  `types?: unknown[]`, and `[key: string]: unknown` from Control Plane history
  models.
- Add Control Plane-owned adapter functions at the WebSocket client/API boundary
  that normalize History RPC responses into browser-facing models.
- Keep the browser ignorant of internal tRPC procedure names beyond the existing
  Control Plane WebSocket method strings.
- Keep generic event `data` typed as JSON or `unknown` only where the event
  envelope is intentionally generic.
- Update timeline, selected workspace, chat sidebar, dashboard, and event panel
  code to use the explicit models.
- Add or update tests for model adapters and timeline inputs.

### Definition of Done

- Control Plane history stores and view models no longer rely on `unknown[]` for
  known History response sections.
- `SelectedHistoryState` has no open string index signature.
- `controlPlaneApi.ts` contains the Control Plane boundary adapter for browser
  WebSocket responses.
- Browser-facing models are Control Plane-owned and do not expose raw Telegram
  payloads or database rows.
- Existing Control Plane timeline tests still pass.
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
  - History Sync recovering through its own history tables plus Telegram read and
    history-fetch tRPC
- Update `docs/02-architecture/component-boundaries.md` to state that History
  Sync may compose history reads from Telegram-owned read models, but must not
  parse Telegram raw storage.
- Add a short source-audit section to the relevant plan or event-plane document.
- Run source audits:
  - Gateway source has no direct Telegram table imports.
  - History Sync source has no direct Telegram table imports.
  - Gateway Telegram responses have tests proving `raw` is absent.
  - Control Plane history models have no `unknown[]` or open index signature for
    known History state.
- Run the full repository check.

### Definition of Done

- Documentation matches the implemented read paths.
- Audit commands are recorded with the final result.
- No direct cross-domain storage reads remain for Gateway Telegram reads or
  History Sync observability reads.
- No known History UI response section is modeled as `unknown[]`.
- Existing `npm run check` passes.

## Validation Checklist

- `rg -n "@agentg/database/(schema|client)|drizzle-orm" packages/gateway/src`
  returns no direct database usage unless a new Gateway-owned storage need was
  explicitly introduced.
- `rg -n "telegramChats|telegramMessages|telegramUsers|telegramChatFolders" packages/history-sync/src`
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
- `rg -n "telegramChats|telegramMessages|telegramUsers|telegramChatFolders|chat\\.raw|raw\\.positions" packages/history-sync/src`
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
- History Sync no longer reads or parses Telegram storage tables directly.
- History Sync composes History-owned read DTOs from History storage plus
  Telegram-owned read DTOs.
- Control Plane has explicit browser-facing models for known History response
  shapes.
- Gateway external protocol remains stable. Control Plane browser chat-list
  reads use `controlPlane.*` methods because they are Control Plane-owned
  browser models.
- No shared internal contracts package is introduced.
- The documentation and source audits agree with the implemented boundaries.
