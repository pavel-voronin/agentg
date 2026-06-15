# Telegram Files

## Contract Status

This document is the contract for Telegram file handling in AgenTG.

The implementation must match this document. A runtime path, database state,
event payload, Dashboard behavior, or observability panel that departs from this
contract is a defect, not an alternative architecture.

This document describes the current target architecture only. It does not define
temporary old/new branches, dual behavior, or migration-only modes.

## Responsibility

The Telegram Files subsystem owns the product media cache for Telegram file
references discovered by the Telegram domain.

It is responsible for:

- extracting file references from Telegram chats, messages, notifications,
  stories, stickers, themes, backgrounds, and user profile details;
- materializing stable file slots for Telegram owners;
- deduplicating slots into durable file assets;
- applying file download policy;
- maintaining the product download queue;
- coordinating TDLib file download requests;
- canonicalizing downloaded files into repository-owned local media storage;
- exposing ready canonical file URLs that local infrastructure routes to the
  dedicated Telegram file server;
- handling TDLib file generation requests;
- publishing file owner and queue events;
- exposing semantic telemetry, logs, traces, and dashboards for the file
  pipeline.

The subsystem belongs to the Telegram domain. Other domains must not know its
slot names, owner model names, policy causes, queue tables, event payload
internals, or Dashboard procedure names.

## Non-Responsibilities

The subsystem does not own:

- generic attachment extraction for non-Telegram domains;
- content analysis, OCR, transcription, embeddings, or assistant memory;
- public file serving outside the trusted local Dashboard boundary;
- a durable raw TDLib update log;
- cross-domain UI composition;
- Dashboard polling or background Dashboard procedure calls;
- permanent support for old procedure names, event shapes, metric names, or
  table interpretations.

## Owner Boundaries

`packages/telegram/src/files` owns file-specific contracts, policy, queue
behavior, file events, file serving, and file observability.

`packages/telegram/src/repositories` and `packages/telegram/src/storage` own
normalized Telegram persistence. Application services and update handlers call
the file subsystem through the explicit `FileSubsystem` contract. File subsystem
code must not depend on repository or storage internals.

`packages/telegram/src/database` owns Drizzle schema declarations and migration
wiring. `storageSchema.ts` is generated TDLib storage schema and must not be
edited manually.

`packages/telegram/dashboard/backend` may expose Telegram Dashboard procedures
that delegate to file subsystem read and request operations. It must not own
file policy, queue semantics, or media byte serving.

`packages/telegram/dashboard/frontend` may render `FileRef` values and send
explicit user-intent requests. It must not infer internal file state from queue
tables, TDLib file IDs, local paths, or metric series.

## Core Concepts

### TDLib File Fact

A TDLib file fact is the `file` object received from Telegram through TDLib. It
contains TDLib-local file ID, remote ID, remote unique ID, size, expected size,
local path, local download progress, and upload/download flags.

TDLib file facts are input facts. They are not the product media cache state.

### Generated TDLib Storage

The generated `telegram_files` table stores Telegram-shaped TDLib file facts
referenced by generated Telegram storage tables.

The generated `telegram_file_downloads` table stores TDLib download-list rows
for TDLib's own message download list. It is not the product media-cache queue
and must not be used as the source of truth for file backlog, Dashboard media
status, or worker progress.

The generated `telegram_file_generation_requests` table stores active TDLib file
generation requests. The file subsystem owns the runtime execution of those
requests.

### File Asset

A file asset is a durable product media-cache object.

The asset key must be stable:

- use `telegram:<remote.unique_id>` when TDLib provides a non-empty remote
  unique ID;
- otherwise use `tdlib:<file.id>`.

An asset is shared by all owners and slots that point to the same Telegram file.
Asset state belongs to `telegram_file_assets`.

Allowed asset statuses:

- `known`: the file is known and metadata is stored, but no canonical local file
  is ready;
- `ready`: the file is canonicalized and has a safe relative path;
- `failed`: the last download attempt reached a terminal failure.

There is no persistent `ready` or `failed` job status. Terminal download
outcomes are represented on the asset, and the active job row is deleted.

### File Slot

A file slot is a stable reference from a Telegram owner to an asset.

The slot key must be stable for the semantic position of the file, for example
chat avatar small/big, message media item, thumbnail, story media, sticker, or
theme asset. A slot update replaces only the relevant owner scope and must not
delete unrelated owner file state.

Slot state belongs to `telegram_file_slots` and is keyed by:

```text
owner_model + owner_id + slot_key
```

Supported owner models:

- `telegram.activeNotification`
- `telegram.chat`
- `telegram.defaultBackground`
- `telegram.emojiChatThemes`
- `telegram.message`
- `telegram.quickReplyMessage`
- `telegram.stickerSet`
- `telegram.story`
- `telegram.user`

Slots do not own download lifecycle. They point at assets.

### File Job

A file job is active product download work for one asset.

Job state belongs to `telegram_file_download_jobs`.

Allowed job statuses:

- `queued`: waiting for worker claim;
- `downloading`: handed to TDLib and waiting for a completed file snapshot or
  stale reconciliation.

A job stores priority, attempts, `claimed_at`, `last_error`, and timestamps.
`attempts` must count every real TDLib dispatch attempt, including stale
redispatches.

### Canonical File

A canonical file is the product-owned local copy of a downloaded TDLib file.

Canonical files live under:

```text
<TDLIB_FILES_DIR>/agentg-media/
```

The file name must be content-addressed by SHA-256 and may include a safe file
extension derived from MIME type or a safe source extension. Dashboard and read
models must never expose TDLib local paths.

### FileRef

`FileRef` is the read-model contract exposed to Dashboard and Telegram read
models.

It must include:

- owner reference;
- slot key;
- media kind;
- render kind;
- effective status;
- byte size and downloaded byte size when known;
- dimensions and duration when known;
- MIME type and display file name when known;
- download error when failed;
- `canRequest`;
- ready URL when status is `ready`;
- updated timestamp.

The ready URL must use the `/telegram-files/agentg-media/` prefix. Dashboard
must render that URL directly. Local development and deployment infrastructure
must route that prefix to the dedicated Telegram file server; the Dashboard
server must not implement Telegram-specific media routing.

## Inputs

The subsystem receives file references from these paths:

- startup and initial chat ingestion;
- live TDLib update handlers;
- historical message fetch results;
- message content updates;
- chat photo updates;
- chat background updates;
- chat theme updates;
- default background updates;
- emoji chat theme updates;
- notification group updates;
- active notification snapshots;
- quick reply shortcut and message updates;
- sticker set and trending sticker set updates;
- story updates and story deletion;
- user full info updates;
- explicit Dashboard user requests;
- TDLib `updateFile`;
- TDLib `updateFileGenerationStart`;
- TDLib `updateFileGenerationStop`.

Each input must be handled idempotently. Replaying the same TDLib fact or owner
snapshot must not create duplicate slots, duplicate jobs, or duplicate canonical
files.

## Extraction Contract

The extractor must convert Telegram-shaped inputs into file slots without losing
owner semantics.

Extraction must support:

- chat avatars;
- chat background files;
- chat theme files;
- default background files;
- emoji chat theme files;
- message audio, photo, sticker, video, video note, voice note, animation, and
  document files;
- message content replacement updates;
- notification and active notification files;
- quick reply message files;
- sticker set and trending sticker set files;
- story files;
- user full info photo files.

Extractor output must not decide download policy. It only declares owner, slot,
TDLib file fact, media kind, render kind, and display metadata.

## Policy Contract

Download policy decides whether a discovered file is only recorded, queued for
download, or denied.

Policy causes:

- `initialization`
- `live_update`
- `history_fetch`
- `operator_page`
- `explicit_request`

Automatic policy:

- avatars from `initialization` and `live_update` are queued without a byte-size
  limit;
- photos from `live_update` and `operator_page` are queued up to 1 MB;
- thumbnails from `live_update` and `operator_page` are queued up to 1 MB;
- videos from `live_update` and `operator_page` are queued up to 5 MB;
- voice messages from `live_update` and `operator_page` are queued up to 5 MB;
- `history_fetch` records metadata and slots only unless another explicit cause
  requests payload download.

Explicit request policy:

- photos are allowed up to 100 MB and require known byte size;
- thumbnails are allowed without a byte-size limit;
- videos are allowed without a byte-size limit;
- documents are allowed without a byte-size limit;
- voice messages are allowed without a byte-size limit;
- avatars are not manually requestable through `FileRef.canRequest`.

Already-ready assets must not be queued again.

Failed assets must not be retried automatically. An explicit request may create
a new job for a failed asset.

Policy must be deterministic from current asset/job state, source fingerprint,
cause, media kind, and byte size. It must not depend on Dashboard component
state, metric state, wall-clock windows, or cross-domain context.

## Persistence Contract

Recording a file slot update must:

1. Extract file slots from the input.
2. Identify every owner affected by the input.
3. Upsert the TDLib file snapshot into `telegram_tdlib_files`.
4. Upsert or read the file asset in `telegram_file_assets`.
5. Apply download policy.
6. Enqueue a file job when policy says `enqueue` and the asset is not ready.
7. Upsert owner slots into `telegram_file_slots`.
8. Prune stale slots only inside the owner or owner-scope represented by the
   input.
9. Publish owner events for changed owners.
10. Publish queue events when queue-visible state changed.

Slot pruning must never delete slots owned by another model or another owner.

Asset rows must survive slot removal while another owner or future reference may
reuse the same asset. Deleting an asset is a separate retention decision and is
not part of slot replacement.

## Queue State Machine

The product download queue state machine is:

```text
known asset
  -> queued job
  -> downloading job
  -> ready asset + deleted job
```

Failure path:

```text
known/failed asset
  -> queued job
  -> downloading job
  -> failed asset + deleted job
```

Retry path:

```text
failed asset
  -> explicit_request
  -> queued job
```

Stale path:

```text
downloading job past stale threshold
  -> inspect TDLib file
  -> ready asset + deleted job
```

or:

```text
downloading job past stale threshold
  -> inspect TDLib file with fresh progress
  -> refreshed claimed_at
```

or:

```text
downloading job past stale threshold
  -> inspect TDLib file
  -> redispatch TDLib download
  -> refreshed claimed_at + incremented attempts
```

or:

```text
downloading job past stale threshold
  -> bounded retry exhausted or terminal TDLib error
  -> failed asset + deleted job
```

A job must not remain in `downloading` forever. Stale reconciliation must either
record fresh progress and refresh the claim, redispatch and count a dispatch
attempt, produce a ready asset, or fail the asset with a bounded reason.

Worker claim must:

- select queued jobs by priority descending and age ascending;
- atomically move the selected job from `queued` to `downloading`;
- increment attempts;
- set `claimed_at`;
- clear stale `last_error`.

Worker completion must:

- copy the TDLib local file into canonical storage;
- compute SHA-256 while storing;
- mark the asset `ready`;
- set byte size, downloaded byte size, SHA-256, and relative path;
- delete the active job;
- publish affected owner events and queue events;
- request TDLib cleanup when appropriate.

Worker failure must:

- mark the asset `failed` unless it is already `ready`;
- store a useful download error;
- delete the active job;
- publish affected owner events and queue events;
- emit a structured log and metrics.

## Worker Scheduling

The file worker runs inside the Telegram module file resource. It must be
coalesced: multiple wake reasons may request work, but only one tick runs at a
time.

Wake reasons:

- startup;
- queue event;
- manual enqueue;
- slot enqueue;
- completed `updateFile`;
- batch continuation;
- file-download defer retry;
- stale watchdog;
- failure backoff.

The worker must process completed file snapshots before claiming new queued
work. This keeps already-finished TDLib downloads from waiting behind new work.

The worker must respect TDLib scheduler pressure. When TDLib has too much active
or high-priority work, the file worker may defer new queued downloads, but stale
downloading jobs still require watchdog attention.

Concurrency and batch sizes must be bounded. The defaults are implementation
details, but the contract is bounded parallelism, not unbounded file download
fan-out and not global serialization of unrelated Telegram work.

## TDLib Transport Contract

Message-owned files should use TDLib message download-list transport when the
owner information is available.

Non-message files should use TDLib `downloadFile` transport.

TDLib priority must be inside TDLib's native priority range. Invalid priority is
a programming error.

The subsystem must not use TDLib local path as a durable serving URL.

## `updateFile` Contract

Every `updateFile` must:

- upsert the TDLib file snapshot;
- match the product asset only by asset key and latest TDLib file ID;
- update downloaded byte progress for not-ready matching assets;
- signal completed assets even when byte progress did not change;
- queue completed assets for worker canonicalization;
- wake the worker for completed assets.

An `updateFile` for an older TDLib file ID must not mutate a newer asset
snapshot.

## File Generation Contract

TDLib `updateFileGenerationStart` must persist the generation request and start
runtime generation.

TDLib `updateFileGenerationStop` must delete the generation request and abort
runtime generation.

Only `#url#` generation is supported. Unsupported conversions must finish the
TDLib generation with an error.

Generated file downloads must:

- reject non-HTTP and non-HTTPS schemes;
- reject loopback, link-local, private-network, and local filesystem targets;
- enforce a bounded download timeout;
- enforce a bounded generated-file byte limit from both `content-length` and
  streamed body bytes;
- stream to `destination_path`;
- report TDLib generation progress;
- finish TDLib generation successfully only after the destination file is fully
  written;
- stop cleanly when aborted.

Generation exists only to satisfy TDLib file generation requests. It is not a
general-purpose fetch API.

## Serving Contract

Ready file serving is local and file-server-scoped.

The read model exposes `/telegram-files/agentg-media/<file>` only for ready
files. Dashboard renders that URL directly. The browser-facing deployment must
route this prefix to the Telegram file server.

The file server is not a database authorizer. Readiness is enforced by URL
minting: Telegram read models must produce media URLs only from `ready` asset
rows. The file server treats the URL as a local trusted capability and serves
only the canonical content-addressed cache.

The file server must:

- mount the canonical media cache read-only;
- accept only `/telegram-files/agentg-media/` paths;
- reject any non-canonical `/telegram-files/` path;
- reject traversal outside the canonical media cache;
- support normal HTTP file serving semantics outside the Telegram JavaScript
  process, including byte streaming and range requests when the selected server
  supports them;
- return not found for missing files;
- never expose absolute paths to the browser;
- never require Dashboard or Telegram RPC to read file bytes into memory.

The file-facing Dashboard procedures are:

- `telegram.dashboard.requestFile`

Observability and dashboards must use these procedure names.

## Event Contract

The file subsystem publishes two domain events:

- `telegram.files.ownerChanged`
- `telegram.files.queueChanged`

### `telegram.files.ownerChanged`

This event means file references for one owner changed.

Payload must include:

- owner model;
- owner ID;
- the complete current `FileRef[]` for that owner after the change;
- an update timestamp or version suitable for idempotent UI application.

A key-only `ownerChanged` event is not a valid contract because Dashboard cannot
legally call domain procedures from a background event trigger to reconstruct
state.

Every mounted Telegram Dashboard surface that renders file refs must apply this
event locally when the owner is relevant:

- message timelines must update message media slots;
- chat directory views must update chat avatars;
- any future notification, story, sticker, background, or theme view must update
  only the matching owner.

### `telegram.files.queueChanged`

This event means queue-visible aggregate state changed.

Payload must include:

- queued count;
- downloading count;
- remaining count;
- known asset count;
- ready asset count;
- failed asset count;
- total asset count;
- known downloaded bytes;
- known remaining bytes;
- known total bytes;
- unknown remaining count.

The file worker may subscribe to this event to wake itself when queued work
exists. Dashboard may use it to update queue summary state, but it must not use
queue totals to infer individual `FileRef` readiness.

## Dashboard Contract

Dashboard initialization may call Telegram Dashboard procedures needed to mount
the current view.

After initialization, Dashboard must call file procedures only for clear user
intent, such as clicking a request button for a known file slot.

Dashboard must not:

- poll file procedures;
- refresh file refs from lifecycle hooks after mount;
- call file procedures in response to broad events;
- infer individual media readiness from queue gauges;
- know file subsystem table names;
- know TDLib local file paths.

Dashboard must:

- render `FileRef.status` directly;
- show request affordances only when `FileRef.canRequest` is true;
- render ready file URLs directly;
- apply `telegram.files.ownerChanged` payloads to local view state;
- keep explicit request behavior tied to user intent.

## Observability Contract

The file subsystem must emit semantic observability for every operator question
needed to run the pipeline.

Required operator questions:

- How many assets are known, ready, and failed?
- How many jobs are queued and downloading?
- How many bytes remain for active jobs with known size?
- How many active jobs have unknown size?
- Is the worker waking?
- Why is the worker waking?
- Are jobs becoming ready, failing, or staying in downloading?
- How old is the oldest downloading job?
- How many downloading jobs are past the stale threshold?
- Where is worker time spent?
- Where is recording time spent before download work exists?
- Are file-facing Dashboard procedures healthy?
- Are file table DB operations the current pressure source?
- Are file events published and processed?
- Are UI views applying file owner updates?
- Which traces explain recent worker passes?
- Which logs explain terminal failures?

Required metric families:

- `telegram.file.queue.assets`
- `telegram.file.queue.failures`
- `telegram.file.queue.jobs`
- `telegram.file.queue.oldest_downloading_unix_seconds`
- `telegram.file.queue.stale_downloading`
- `telegram.file.queue.bytes`
- `telegram.file.queue.unknown_remaining`
- `telegram.file.generation.duration`
- `telegram.file.generation.outcomes`
- `telegram.file.worker.wake`
- `telegram.file.worker.jobs`
- `telegram.file.worker.stage.duration`
- `telegram.file.record.stage.duration`

Required boundary telemetry:

- RPC server telemetry for `telegram.dashboard.requestFile`;
- DB client telemetry for file tables;
- messaging publish/process telemetry for `telegram.files.*`;
- traces for `telegram.file.worker.tick` and bounded worker stages;
- traces for file record stages;
- logs for worker failure, download failure, stale reconciliation, and TDLib
  cleanup failure.

Metric labels must stay bounded. Do not add chat IDs, message IDs, asset keys,
slot keys, file names, local paths, URLs, trace IDs, or error messages as metric
labels.

High-cardinality facts may appear in structured logs when needed for debugging,
but logs must not become the only place where normal operating state is visible.

The Files dashboard must show:

- red-flag top row for queued backlog, failed assets, backlog without worker
  ticks, failure rate, defer rate, stale recovery, oldest downloading age
  derived from `telegram.file.queue.oldest_downloading_unix_seconds`, and stale
  downloading count;
- backlog and bytes panels;
- worker wake, job outcome, and stage panels;
- generation outcome and duration panels;
- file discovery and record-stage panels;
- file-facing Dashboard RPC panels using current procedure names;
- file table DB rate and latency panels;
- file event send and process panels;
- UI owner-update apply panels when UI apply telemetry exists;
- recent Jaeger file worker traces.

Server-side event processing is not proof that a mounted browser view applied a
file owner update. A dashboard panel must not claim UI application unless it is
backed by UI apply telemetry or another explicit UI-side signal.

Missing telemetry must remain distinguishable from a valid zero value.

## Security And Privacy Contract

The subsystem handles local Telegram user data. It must keep file payload access
inside the trusted local Dashboard and file-server boundary.

It must not:

- expose absolute TDLib paths;
- expose canonical files through Dashboard module-file serving or Telegram RPC;
- fetch arbitrary local or private-network URLs for generation;
- place user content, message text, URLs, local paths, asset keys, chat IDs, or
  message IDs in metric labels;
- use file content as a cross-domain identifier.

Canonical file paths must be safe relative paths below the configured TDLib file
directory.

## Retention Contract

The file subsystem owns readiness, not long-term retention policy.

Ready assets and canonical files are retained by the current contract. Slot
removal does not delete canonical files by itself.

A retention change must be domain-owned, observable, and explicit about whether
it deletes slots, assets, canonical files, or TDLib cache files.

## Test Contract

Changes to the subsystem must keep tests for:

- extraction coverage for every supported owner/content kind;
- policy causes and size limits;
- request path through `telegram.dashboard.requestFile`;
- queue state transitions;
- stale reconciliation, bounded retry, and terminal failure;
- canonical storage and path safety;
- static file traversal rejection;
- generation URL validation and abort handling;
- owner event payload shape and Dashboard application;
- queue event payload shape;
- bounded telemetry labels.

Do not require dedicated regression tests for static Grafana dashboard JSON,
dashboard panels, or tiles. Dashboard-only edits should stay lightweight: review
the PromQL, links, and operator text directly, and validate JSON syntax when
needed. Tests belong on executable behavior, telemetry emission/classification,
and browser code that applies live events.

The scoped verification command for Telegram file subsystem changes is:

```text
npm run check:telegram
```

Changes that touch Dashboard shell or shared Dashboard serving must also run:

```text
npm run check:dashboard
```

Changes that touch telemetry package code or telemetry package tests must run:

```text
npm run check:telemetry
```

Run the full repository gate before final integration when the change crosses
Telegram, Dashboard, and telemetry boundaries:

```text
npm run check
```

## Required Invariants

- TDLib file facts are input facts, not product cache state.
- `telegram_file_download_jobs` is the product download work queue.
- `telegram_file_downloads` is not the product download work queue.
- Slots point to assets; slots do not own download lifecycle.
- Assets may be shared by many slots and owners.
- Ready files are served only through canonical relative paths.
- Failed assets are retried only by explicit user intent.
- A downloading job must not be permanent.
- Owner file events must carry enough data for Dashboard to update without
  event-triggered procedure calls.
- Queue events describe aggregate queue state only.
- Dashboard file procedures are initialization or user-intent paths, not polling
  paths.
- Observability must answer state, progress, latency, failure, and freshness
  questions without relying on high-cardinality metric labels.
- Current docs, dashboards, and implementation must agree. Tests must cover the
  executable behavior and telemetry contracts that make the dashboard truthful,
  but static dashboard and tile composition does not need its own test suite.
