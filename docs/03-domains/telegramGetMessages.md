# Telegram Get Messages

## Purpose

`telegram.getMessages` is the single public Telegram domain operation for
reading Telegram message history.

Consumers ask Telegram for messages. They must not know whether Telegram answers
from local storage, live coverage, durable coverage, a history fill job, TDLib,
topic-specific TDLib procedures, or file queues.

This document is the source of truth for the current implementation.
`getMessages` returns either ready local messages or a pending request id for
asynchronous HistoryReconciler completion.

## Goals

- Keep one public operation: `telegram.getMessages`.
- Hide TDLib, coverage storage, history fetch mechanics, and file slot
  reconciliation behind the Telegram domain boundary.
- Support message history for chats, forum topics, direct-message topics, Saved
  Messages topics, and message threads.
- Return fast when the requested messages are not ready.
- Return a synchronous result only when coverage proves that the local read
  model is usable as is.
- Complete missing history asynchronously through a Telegram-owned
  `HistoryReconciler`.
- Publish a domain event when a pending request becomes ready or fails.
- Keep file slots and file downloads outside message history readiness.
- Support both interactive chat scrolling and range-based synchronization or
  export workflows.
- Avoid artificial product limits in this local hobby tool.

## Non-Goals

- Do not expose raw TDLib procedures or TDLib cursors to Dashboard, Gateway, or
  other consumers.
- Do not add public `downloadMessages`, `requestMessages`, `fetchPage`, or
  materialization strategy procedures.
- Do not make file slot materialization or file download completion part of
  default message history readiness.
- Do not add compatibility envelopes or legacy response shapes.
- Do not encode request ids, owner keys, chat ids, message ids, raw timestamps,
  or date ranges into metric labels.

## Ubiquitous Language

- `MessageSelector`: the domain shape of the requested messages.
- `MessageOwner`: the Telegram entity whose message history is being read.
- `Message`: the Telegram domain read model defined by
  `messageSchema`.
- `PageSelector`: a selector for an interactive chat window.
- `RangeSelector`: a selector for all messages in a time interval.
- `MessagePage`: the local read model rows selected for a `PageSelector`.
- `Coverage`: durable or live proof that a time interval can be read from local
  storage for a message owner.
- `CoverageGap`: the part of a requested interval that is not covered.
- `HistoryFillRequest`: a durable Telegram-owned job to make a selector ready.
- `HistoryReconciler`: the internal Telegram subsystem that processes
  `HistoryFillRequest` jobs.
- `requestId`: a deterministic, readable identifier for a history fill request.
- `ReadyEvent`: a domain event telling consumers that a pending request is
  ready.
- `FileSubsystem`: the separate subsystem that materializes file slots from
  stored Telegram objects, downloads files, and publishes file owner updates.

## Public Contract

`telegram.getMessages` accepts a message owner and a domain selector, not a
TDLib operation shape.

```ts
type MessageOwner =
  | {
      chatId: string;
      kind: 'chat';
    }
  | {
      chatId: string;
      kind: 'forumTopic';
      topicId: string;
    }
  | {
      chatId: string;
      kind: 'directMessagesTopic';
      topicId: string;
    }
  | {
      kind: 'savedMessagesTopic';
      topicId: string;
    }
  | {
      chatId: string;
      kind: 'messageThread';
      messageId: string;
    };

type GetMessagesInput =
  | {
      owner: MessageOwner;
      selector: {
        beforeMessageId?: string;
        count: number;
        kind: 'page';
      };
    }
  | {
      owner: MessageOwner;
      selector: {
        endAt: string;
        kind: 'range';
        startAt: string;
      };
    };
```

`owner` is the domain identity of the history being read. It is not a TDLib
procedure selector. Telegram resolves the owner internally.

`page.count` is the number of messages requested by the consumer. It is not a
TDLib page size and it is not a safety cap.

`range` has no count. It means all locally readable messages in
`[startAt, endAt)`.

```ts
type GetMessagesOutput =
  | {
      messages: Message[];
      reachedStart: boolean;
      status: 'ready';
    }
  | {
      messages: Message[];
      status: 'ready';
    }
  | {
      requestId: string;
      status: 'pending';
    };
```

`pending` returns no messages. It means Telegram accepted responsibility for
making the selector ready.

`ready` returns `Message[]`. It must not return raw TDLib messages, storage
rows, file queue rows, or file readiness state.

`ready` for a `PageSelector` always includes `reachedStart` because chat
scrolling must know whether older messages exist.

`ready` for a `RangeSelector` does not include `reachedStart`.

## Selector Semantics

### PageSelector

Interactive message UIs use `PageSelector`.

```ts
{
  owner: {
    kind: 'chat',
    chatId: '-100123'
  },
  selector: {
    kind: 'page',
    beforeMessageId: '123456',
    count: 100
  }
}
```

Telegram internally:

1. Normalizes `count`.
2. Resolves the message owner.
3. Reads the local page for that owner before `beforeMessageId`, or the latest
   page when `beforeMessageId` is absent.
4. Resolves the date interval that makes this page trustworthy.
5. Checks durable and live coverage for that owner and interval.
6. Returns `ready` when the interval is covered.
7. Enqueues a `HistoryFillRequest` and returns `pending` when any coverage gap
   exists.

When `beforeMessageId` is not available locally, `getMessages` must still return
`pending`. The reconciler owns resolving that cursor through TDLib. A missing
local cursor is not a public error unless the owner or selector is invalid.

The consumer does not choose TDLib behavior. Telegram owns the conversion from
message id pagination to owner-scoped coverage intervals.

For a latest page request where `beforeMessageId` is absent, the page boundary
is the newest local or fetched message in that owner, rounded to the next
history second. It is not wall-clock `now`. Otherwise a deterministic
`anchor=latest` request would be a moving target: a worker could complete the
request for one second and the next read could immediately see a new coverage
gap for the next second.

When the owner has no local messages, owner-scoped coverage from
`HISTORY_PAST_BOUNDARY` is the proof for an empty latest page. In that case
`getMessages` returns `ready` with `messages: []` and `reachedStart: true`.
Without that coverage proof, the same request returns `pending`.

### RangeSelector

Synchronization, export, analytics, and maintenance flows use `RangeSelector`.

```ts
{
  owner: {
    kind: 'forumTopic',
    chatId: '-100123',
    topicId: '7'
  },
  selector: {
    kind: 'range',
    startAt: '2026-01-01T00:00:00.000Z',
    endAt: '2026-02-01T00:00:00.000Z'
  }
}
```

Telegram internally:

1. Resolves the message owner.
2. Normalizes `[startAt, endAt)`.
3. Checks durable and live coverage for that owner and interval.
4. Returns every local message for that owner in the range when it is covered.
5. Enqueues a `HistoryFillRequest` and returns `pending` when any coverage gap
   exists.

Range consumers do not know message ids. TDLib id pagination stays private.
Internal batching, scheduling, and backpressure are allowed, but they must not
become public count limits or selector knobs.

### MessageOwner

The owner identity is the scope. There is no separate public `scope`, `topic`,
`thread`, TDLib procedure, or materialization mode argument.

Supported owners:

- `chat`: whole chat history.
- `forumTopic`: history of one forum topic inside a chat.
- `directMessagesTopic`: history of one channel direct-message topic.
- `savedMessagesTopic`: history of one Saved Messages topic.
- `messageThread`: history of one message thread addressed by its owning
  message.

Telegram validates that the owner exists when local state is available. If owner
state is not local yet but TDLib can resolve it during history fill, `getMessages`
returns `pending` and the reconciler finishes owner discovery internally.

Local reads filter messages by owner. Topic and thread owners must not read the
whole chat as if it were the requested owner.

Coverage is owner-scoped. Durable coverage for a topic or thread proves only that
owner. Durable coverage for a whole chat proves the chat owner. It must not be
silently reused as topic coverage unless the implementation proves that the
coverage was produced by a whole-chat source that includes that owner's messages.

Live coverage is observed at the chat update stream. For owners inside a chat,
live coverage can participate in readiness only after Telegram maps the owner to
the chat whose updates prove that owner.

## Request Ids

`requestId` is deterministic and readable.

Use a stable, escaped key-value string instead of an opaque hash:

```text
telegram.getMessages;selector=page;owner=chat:-100123;beforeMessageId=123456;count=100
telegram.getMessages;selector=page;owner=chat:-100123;anchor=latest;count=100
telegram.getMessages;selector=range;owner=forum-topic:-100123:7;startAt=2026-01-01T00:00:00.000Z;endAt=2026-02-01T00:00:00.000Z
telegram.getMessages;selector=range;owner=saved-messages-topic:42;startAt=2026-01-01T00:00:00.000Z;endAt=2026-02-01T00:00:00.000Z
```

The same normalized selector always produces the same `requestId`. Repeated
calls coalesce into the same durable job.

The string is diagnostic and usable for exact equality. Consumers must not parse
it to choose behavior. The `requestId` must not encode worker names, TDLib
procedure names, storage strategy, or materialization strategy.

Canonical encoding rules:

- Normalize dates to ISO strings in UTC.
- Normalize numeric Telegram ids to decimal strings.
- Sort key-value fields in the documented order.
- Escape separators in values before joining.
- Do not include chat titles, user names, message text, or error messages.

`requestId` is allowed in:

- Durable job rows.
- Domain events.
- Logs.
- Dashboard details.

`requestId` is forbidden in:

- Metric labels.
- Span names.
- Production span attributes.
- Dashboard series dimensions.

## TDLib Boundary

TDLib history retrieval is owner-specific and id-cursor based.

`getChatHistory` accepts:

- `chat_id`
- `from_message_id`
- `offset`
- `limit`
- `only_local`

TDLib requires `limit <= 100` and can return fewer messages than requested.

`getChatMessageByDate` is an anchor helper. It returns the last message no later
than a date. It is not the main pagination mechanism.

Other owner kinds use different private TDLib procedures:

| Owner                 | Resolver               | History procedure                   | Date anchor                                       | Local filter             |
| --------------------- | ---------------------- | ----------------------------------- | ------------------------------------------------- | ------------------------ |
| `chat`                | chat id                | `getChatHistory`                    | `getChatMessageByDate`                            | `chatId`                 |
| `forumTopic`          | chat id + topic id     | `getForumTopicHistory`              | no dedicated anchor in the installed TDLib schema | `chatId` + `topic_id`    |
| `directMessagesTopic` | chat id + topic id     | `getDirectMessagesChatTopicHistory` | `getDirectMessagesChatTopicMessageByDate`         | `chatId` + `topic_id`    |
| `savedMessagesTopic`  | topic id               | `getSavedMessagesTopicHistory`      | `getSavedMessagesTopicMessageByDate`              | `topic_id`               |
| `messageThread`       | chat id + root message | `getMessageThreadHistory`           | no dedicated anchor in the installed TDLib schema | thread root / `topic_id` |

TDLib id validation stays inside Telegram:

- chat ids, message ids, direct-message topic ids, and Saved Messages topic ids
  are TDLib `int53` values represented as decimal strings at the public
  boundary;
- forum topic ids and TDLib date values are `int32`;
- date selectors normalize to UTC and TDLib Unix seconds while stored reads
  preserve the public `[startAt, endAt)` interval.

Therefore:

- Public selectors stay domain-shaped.
- Owner identity determines the private TDLib procedure.
- Reconciler uses TDLib `from_message_id` internally where the procedure
  supports it.
- Public `beforeMessageId` is exclusive. TDLib history calls include
  `from_message_id` when `offset = 0`, so the reconciler must drop or dedupe the
  anchor message before counting visible results.
- Dates define owner-scoped coverage intervals.
- For `[startAt, endAt)`, a TDLib date anchor targets the last whole second
  before `endAt`; local reads and coverage writes still use exclusive `endAt`.
- Message ids drive TDLib pagination.
- A public `count` larger than 100 requires multiple TDLib pages.
- A `RangeSelector` requires paging backward from a date anchor until the range
  is covered.
- Owners without a dedicated date anchor still support `RangeSelector`; the
  reconciler pages owner history until selector readiness proves the range or the
  beginning of that owner history is reached.
- TDLib `messages` responses may contain null entries. Null entries do not
  count as fetched messages and must not be persisted.
- TDLib `total_count` is approximate. It must not prove readiness, coverage, or
  beginning of history.
- A TDLib page smaller than the requested private limit does not by itself prove
  the beginning of history. Beginning is proven by TDLib owner semantics or by
  the readiness check after persisted coverage.

## Message History Readiness

For the current implementation, `ready` means:

- The requested owner and selector map to a local message interval.
- Durable coverage plus valid live coverage covers that owner and interval.
- The local read model can be used as the answer.

Live coverage is part of the readiness source. Implementation must verify that
the current live coverage model is still a strict guarantee before wiring it
into readiness.

File state is not part of message history readiness. `getMessages` history
readiness does not wait for file slot materialization and does not wait for file
downloads.

Read messages may have an empty `media.files` array when messages are ready
before the FileSubsystem has materialized their slots. The FileSubsystem later
publishes owner updates when slots or file assets change.

## History Reconciler

`HistoryReconciler` is an internal Telegram subsystem with its own durable
queue, lifecycle, observability, and Dashboard section.

Durable job rows contain:

- `requestId`.
- `owner`.
- `selector`.
- `status`.
- `attemptCount`.
- `nextRunAt`.
- `lockedAt`.
- `lastFailureReason`.
- `createdAt`.
- `updatedAt`.

Active statuses:

- `queued`.
- `running`.
- `deferred`.

Terminal failure status:

- `failed`.

Completion removes the request from the active backlog after publishing
`telegram.messages.ready`. Completion is recorded by events, logs, and transition
metrics, not by leaving completed jobs in the active backlog gauge.

State transitions:

- `queued -> running` when a worker claims the job.
- `running -> queued` when the worker saves progress and more work remains.
- `running -> deferred` when TDLib pressure or a transient dependency condition
  requires a later attempt.
- `deferred -> queued` when `nextRunAt` is reached.
- `running -> failed` when the job reaches a terminal bounded failure.
- `running -> completed` when readiness passes; `completed` is a terminal
  transition, not an active durable status.

Stale `running` jobs are returned to `queued` after the lock timeout. The retry
policy owns `attemptCount`, `nextRunAt`, `lockedAt`, and terminal failure.
`pending` must only be returned when there is an active path to worker progress.
A failed row must not make `getMessages` return `pending` forever without
requeueing or rejecting the selector.

The target deployment has exactly one active `HistoryReconciler` runner. This is
an architectural constraint, not an optimization target. Concurrent multi-runner
execution is out of scope for `getMessages`, and durable job claiming may rely
on the single-runner invariant. Running more than one reconciler runner against
the same database is an invalid deployment.

It owns:

- Accepting `HistoryFillRequest` jobs.
- Deduplicating jobs by deterministic `requestId`.
- Resolving message owners.
- Rechecking owner-scoped coverage before TDLib work.
- Fetching missing history from TDLib.
- Persisting messages.
- Writing owner-scoped coverage.
- Publishing completion or failure events.
- Deferring or retrying work under TDLib pressure or transient failures.

It does not own:

- Public message read contracts.
- File download completion.
- Dashboard rendering of message bubbles.

## Reconciler Completion Rule

A job is complete only when the original selector is ready.

It is not complete after one TDLib call.

For `PageSelector`, the reconciler continues until:

- the requested owner page has enough local messages and its interval is
  covered;
- or the beginning of owner history is reached;
- or the job fails.

For `RangeSelector`, the reconciler continues until:

- `[startAt, endAt)` is covered for the owner;
- or the beginning of owner history proves there are no older messages;
- or the job fails.

The worker may process one TDLib page per tick. The durable job remains
`queued`, `running`, or `deferred` until the selector becomes ready or fails.

Single-pass history fetch behavior is not the target completion model for
`getMessages`. `getMessages` pending requests require a durable job that lives
until completion or failure.

## Events

The reconciler publishes:

```ts
type TelegramMessagesReadyEvent = {
  owner: MessageOwner;
  requestId: string;
  selector: GetMessagesInput['selector'];
};

type TelegramMessagesFailedEvent = {
  owner: MessageOwner;
  reason: HistoryFillFailureReason;
  requestId: string;
  selector: GetMessagesInput['selector'];
};
```

Event types:

- `telegram.messages.ready`
- `telegram.messages.failed`

Dashboard listens for these events through the existing event stream and updates
local pending/request state from the event payload.

Dashboard must not call `telegram.getMessages` in response to
`telegram.messages.ready` or `telegram.messages.failed` unless the call belongs
to the same explicit user action that created the pending request. Broad event
handlers, background refresh, timers, and lifecycle hooks must not call
procedures.

Non-Dashboard orchestration may await `requestId` and then call
`telegram.getMessages` again when that call is part of the same domain workflow.
The event is the completion signal; it is not a command to refresh every
consumer.

After `telegram.messages.failed`, the request is no longer active. A later
`telegram.getMessages` call with the same selector rechecks local readiness. If
the selector is still not ready, Telegram must either enqueue an active retry
path and return `pending`, or reject an invalid selector as a direct input error.
It must not return `pending` for a terminal failed request that no worker will
process.

## File Subsystem Interaction

File slot materialization belongs to the FileSubsystem, not to the
HistoryReconciler.

When the reconciler persists messages, it only makes those stored messages
eligible for FileSubsystem slot materialization. The reconciler must not call
per-message slot recording and must not wait for slots before writing coverage
or publishing `telegram.messages.ready`.

Stored messages are the durable source for async message slot materialization.
The storage model needs a per-message marker that lets the FileSubsystem
distinguish these states:

- message slots are not materialized yet;
- message slots were materialized and the message has no files;
- message content changed and slots must be materialized again.

The FileSubsystem owns the worker that scans stored messages with stale or
missing slot materialization markers, records slots through the existing
FileSubsystem boundary, updates the marker, schedules file downloads, and
publishes file owner updates.

File queue state and file owner updates are visible through the FileSubsystem
dashboard and events.

Expected flow:

1. Reconciler stores messages.
2. Reconciler writes coverage.
3. Reconciler publishes `telegram.messages.ready` when selector readiness
   passes.
4. FileSubsystem materializes message file slots asynchronously from stored
   messages.
5. FileSubsystem downloads files independently.
6. FileSubsystem publishes owner/file events.
7. Dashboard updates message media refs from file events.

## Future Improvement: Content Readiness

This section is part of the target architecture, but it is not part of the
current implementation slice.

The current `telegram.getMessages` contract answers only message history
readiness. That readiness means the requested messages are locally readable. It
does not mean file slots are materialized, and it does not mean referenced files
are downloaded.

Future consumers will need explicit content readiness levels:

- `basic`: message history is ready and `Message[]` can be returned from the
  local read model.
- `complete`: message history is ready, file slots for the selected messages are
  materialized, and every file asset referenced by those slots is locally ready.

`slots` is not a public readiness profile. Slot materialization is an internal
stage between history readiness and complete content readiness. Exposing it as a
consumer choice would leak FileSubsystem mechanics into the public Telegram
operation.

The future extension must keep `telegram.getMessages` as the product-level
operation. It may add an explicit `readiness` field to the input and to
completion events, but it must not add public procedures such as
`getMessagesWithSlots`, `downloadMessages`, or `waitForFiles`.

Future request ids must include the requested readiness profile. The same owner
and selector with `basic` readiness and `complete` readiness are different
requests because they complete under different guarantees.

Request-level content readiness needs a Telegram-owned coordinator, not a
FileSubsystem request mode.

The coordinator owns:

- mapping `requestId` to `{ owner, selector, readiness }`;
- listening to `telegram.messages.ready` for history readiness;
- listening to FileSubsystem owner/file events for slot and asset progress;
- checking the selected messages, their slot materialization markers, and their
  referenced file asset readiness through Telegram-owned storage boundaries;
- waking the FileSubsystem through its existing subsystem boundary when stored
  messages still need slot materialization;
- publishing a Telegram message readiness event for the requested readiness
  level when the guarantee is satisfied.

The coordinator must not fetch TDLib history directly. The HistoryReconciler
continues to own history fill. The FileSubsystem continues to own slot
materialization, file queueing, downloads, and owner/file events.

The FileSubsystem must not receive or store `getMessages` request ids as its
primary model. A single message or file asset can belong to many requests, so
putting request correlation inside FileSubsystem would create a hidden
cross-request coordinator there. FileSubsystem stays owner/asset based.

Dashboard remains event-driven. It must not call `telegram.getMessages` from
background file events. If a UI wants progressive display, it can issue a user
intent request for `basic` first and a separate user intent request for
`complete` when that product workflow needs complete content.

## Observability Contract

The reconciler needs a Telegram Dashboard section. It is a subsystem, not one
metric.

### Metrics

Every metric below has a Dashboard/readback role. Do not add another reconciler
metric unless it answers a different operator question.

| Metric                                                | Instrument and unit            | Labels                                           | Source                  | Dashboard role                              |
| ----------------------------------------------------- | ------------------------------ | ------------------------------------------------ | ----------------------- | ------------------------------------------- |
| `telegram.get_messages.requests`                      | counter, requests              | `result`, `selector.kind`, `owner.kind`          | `getMessages` ingress   | ready versus async demand                   |
| `telegram.history.reconciler.jobs`                    | observable gauge, jobs         | `job.status`, `owner.kind`                       | durable job read model  | current backlog                             |
| `telegram.history.reconciler.oldest_job_age`          | observable gauge, seconds      | `job.status`, `owner.kind`                       | durable job read model  | stale backlog                               |
| `telegram.history.reconciler.last_transition.seconds` | observable gauge, Unix seconds | `transition`                                     | transition recorder     | worker liveness                             |
| `telegram.history.reconciler.job.duration`            | histogram, seconds             | `result`, `owner.kind`, `error.type` when failed | terminal job transition | pending latency and throughput via `_count` |
| `telegram.history.reconciler.stage.duration`          | histogram, seconds             | `stage`, `error.type` when failed                | worker stage wrapper    | latency source                              |
| `telegram.history.reconciler.messages`                | counter, messages              | `message.result`                                 | TDLib fetch and persist | fetched versus stored volume                |
| `telegram.history.reconciler.pages`                   | counter, pages                 | `page.result`                                    | TDLib fetch             | TDLib paging workload                       |
| `telegram.history.reconciler.coverage_intervals`      | counter, intervals             | `coverage.result`                                | coverage check/write    | coverage progress                           |
| `telegram.history.reconciler.failures`                | counter, failures              | `stage`, `error.type`                            | failed transition       | bounded failure triage                      |

Allowed label values:

- `result = ready | pending_enqueued | pending_coalesced | completed | failed | skipped_covered`
- `selector.kind = page | range`
- `owner.kind = chat | forum_topic | direct_messages_topic | saved_messages_topic | message_thread`
- `job.status = queued | running | deferred | failed`
- `transition = completed | deferred | failed | skipped_covered`
- `stage = claim | coverage_check | tdlib_fetch | persist | publish`
- `message.result = fetched | stored`
- `page.result = fetched | empty`
- `coverage.result = written | already_covered`
- `error.type = coverage_write_error | event_publish_error | invalid_job | storage_error | tdlib_error | tdlib_unavailable | timeout | unexpected_error`

There is no separate `telegram.history.reconciler.jobs.processed` metric. Job
throughput comes from the `_count` series of
`telegram.history.reconciler.job.duration`.

Bad signs:

- pending dominates ready during ordinary chat navigation;
- queued or running backlog grows without completed transitions;
- oldest job age grows while the worker is enabled;
- job duration p95 grows while stage duration does not identify the source;
- fetched message rate is high while stored message rate stays low;
- page rate is high while coverage intervals and completions do not advance;
- any sustained failure rate.

### Forbidden Metric Labels

Do not use these as metric labels:

- `requestId`
- owner key
- `chatId`
- message id
- raw timestamp
- raw date range
- chat title
- user id
- exact count requested
- error message

### Spans

Use stable low-cardinality spans:

- `telegram.get_messages`
- `telegram.history.reconciler.tick`
- `telegram.history.reconciler.claim`
- `telegram.history.reconciler.coverage_check`
- `telegram.history.reconciler.tdlib_fetch`
- `telegram.history.reconciler.persist`
- `telegram.history.reconciler.publish`

IDs, owner keys, dates, request ids, and error text must not appear in span
names.

Production span attributes may include only low-cardinality values: selector
kind, owner kind, stage, result, bounded counts, and `error.type`. Put
`requestId`, exact owner keys, chat ids, message ids, and exact date ranges in
logs or Dashboard details, not in spans.

### Logs

Logs are for domain decisions:

- request coalesced;
- request accepted;
- request skipped because already covered;
- job deferred because TDLib pressure is too high;
- job failed with bounded reason;
- job completed and ready event published.

Logs may contain `requestId`, selector details, chat id, and exact interval
fields because logs are drilldown evidence. Logs may also contain the canonical
owner key. These fields must not be promoted into metric labels.

## Dedicated Dashboard

This document has a dedicated Telemetry Dashboard route:
`/telemetry/get-messages`.

That route embeds the Grafana dashboard `Telegram Get Messages`
(`uid: telegram-get-messages`). This dashboard is the readback surface for this
document. It does not replace broader Telegram, History Reconciler, Files,
Operations, or platform dashboards where the same metrics may also participate.

The dedicated dashboard must contain everything needed to verify this document
from one place:

- every metric from the table above;
- direct drilldown links for `telegram.get_messages` traces;
- direct drilldown links for History Reconciler traces;
- direct drilldown links for relevant logs;
- recent `telegram.messages.ready` and `telegram.messages.failed` events;
- enough panel descriptions for an operator to understand what each panel proves
  and which bad sign it catches.

It is not a raw metric inventory. It is the document-level operator surface:
red flags first, then backlog and flow, then latency source, workload, failures,
events, logs, and traces.

First screen:

- queued jobs;
- running jobs;
- deferred jobs;
- failed jobs;
- oldest job age;
- last completed age;
- `getMessages` ready versus pending rate;
- backlog by owner kind.

Drilldown:

- job outcome rate;
- job duration p95;
- stage duration p95;
- fetched versus stored messages;
- TDLib pages and coverage intervals;
- failures by stage and reason;
- recent `telegram.messages.ready` and `telegram.messages.failed` events.

This section routes operator attention. It is not a raw metric inventory.

## Implementation Layout

The implementation must keep the public `getMessages` contract small and keep
history mechanics inside Telegram-owned internal modules.

Do not implement this as one large procedure file. Do not scatter new forms,
owner logic, coverage logic, TDLib paging, queue state, and telemetry into
unrelated existing files.

Target layout:

```text
packages/telegram/src/procedures/getMessages.ts
packages/telegram/src/procedures/get-messages/contract.ts
packages/telegram/src/procedures/get-messages/procedure.ts
packages/telegram/src/procedures/get-messages/requestId.ts
packages/telegram/src/procedures/get-messages/enqueue.ts

packages/telegram/src/domain/models/messageSelection.ts
packages/telegram/src/repositories/messageReadinessRepository.ts
packages/telegram/src/repositories/messageRepository.ts
packages/telegram/src/storage/messageReadStorage.ts
packages/telegram/src/storage/messageRowStorage.ts
packages/telegram/src/storage/reconcilerCoverageStorage.ts
packages/telegram/src/storage/reconcilerJobStorage.ts
packages/telegram/src/reconciler/runtime.ts
packages/telegram/src/reconciler/adapters/historySource.ts
packages/telegram/src/reconciler/adapters/historyPage.ts
packages/telegram/src/reconciler/telemetry.ts

packages/telegram/src/files/messageSlots.ts
```

Responsibilities:

- `procedures/getMessages.ts` is the stable procedure entrypoint used by module
  registration. It should only wire resources to the implementation.
- `procedures/get-messages/contract.ts` owns input and output schemas for the
  public procedure.
- `procedures/get-messages/procedure.ts` owns the `ready | pending`
  orchestration and must stay thin.
- `procedures/get-messages/requestId.ts` owns canonical request id encoding.
- `procedures/get-messages/enqueue.ts` owns pending job enqueue/coalescing and
  calls the reconciler subsystem.
- `domain/models/messageSelection.ts` owns internal owner normalization,
  selector validation, owner keys, and owner-scoped selection values.
- `repositories/messageReadinessRepository.ts` owns readiness checks, coverage
  gap decisions, and final repository hydration of ready `Message[]`.
- `repositories/messageRepository.ts` owns `Message` hydration from normalized
  rows and file/sender facts.
- `storage/messageReadStorage.ts` owns local message-row reads by owner,
  selector, and refs.
- `storage/messageRowStorage.ts` owns SQL selections for normalized message
  rows and sender display facts.
- `storage/reconcilerCoverageStorage.ts` owns owner-scoped coverage reads,
  writes, live coverage mapping, and interval subtraction for message owners.
- `storage/reconcilerJobStorage.ts` owns durable reconciler job persistence and
  state transitions.
- `reconciler/runtime.ts` owns worker lifecycle and completion rules.
- `reconciler/adapters/historySource.ts` owns private TDLib owner-specific
  paging and date anchor behavior.
- `reconciler/adapters/historyPage.ts` owns TDLib history message conversion to
  durable message records.
- `reconciler/telemetry.ts` owns metric, span, and log emission for this
  subsystem.
- `files/messageSlots.ts` owns async materialization of stored message file
  slots. It is part of the FileSubsystem, not the HistoryReconciler.

Type placement rules:

- `Message` stays in `domain/models/message.ts`.
- Procedure input and output schemas stay in
  `procedures/get-messages/contract.ts`.
- Internal owner, request id, job, coverage, TDLib cursor, and reconciler types
  stay in their owning internal files under `procedures/get-messages` or
  `reconciler`.
- Add a package root export only when a real current external consumer needs it.
- Do not export procedure-specific `Input` or `Output` DTO types for other
  domains.

File size rule:

- A file may own one responsibility from the list above.
- If a file starts to contain two responsibilities, split it before adding more
  behavior.
- Tests must not live next to production code. New tests for this work go under
  `packages/telegram/tests`, mirroring the production path after `src`.

Test layout:

```text
packages/telegram/tests/procedures/getMessages.test.ts
packages/telegram/tests/procedures/get-messages/contract.test.ts
packages/telegram/tests/procedures/get-messages/requestId.test.ts

packages/telegram/tests/domain/models/messageSelection.test.ts
packages/telegram/tests/repositories/messageReadinessRepository.test.ts

packages/telegram/tests/historyCoverage.test.ts
packages/telegram/tests/reconciler/adapters/historySource.test.ts
packages/telegram/tests/reconciler/runtime.test.ts
packages/telegram/tests/reconciler/telemetry.test.ts

packages/telegram/tests/storage/fileReadStorage.test.ts
packages/telegram/tests/storage/messageReadStorage.test.ts
packages/telegram/tests/storage/messageStorage.test.ts
packages/telegram/tests/storage/reconcilerCoverageStorage.test.ts
packages/telegram/tests/storage/reconcilerJobStorage.test.ts
```

## Test Coverage

### `getMessages`

- Covered `PageSelector` returns `ready`.
- Covered empty latest `PageSelector` returns `ready` with `messages: []` and
  `reachedStart: true`.
- Covered `RangeSelector` returns `ready`.
- Page `ready` includes `reachedStart`.
- Range `ready` does not include `reachedStart`.
- Uncovered `PageSelector` returns `pending` with deterministic readable
  `requestId`.
- Uncovered `RangeSelector` returns `pending` with deterministic readable
  `requestId`.
- `pending` returns no messages.
- `ready` returns `Message[]`, not TDLib messages, storage rows, or file
  queue state.
- A missing local `beforeMessageId` returns `pending`, not a cursor-not-found
  error.
- `getMessages` does not call TDLib directly.
- `getMessages` does not record files directly.
- Repeated uncovered selector returns the same `requestId`.
- A terminal failed request is not reported as `pending` unless Telegram also
  requeues an active worker path.
- `RangeSelector` has no artificial count cap.
- Owner-scoped local reads do not return messages from another owner.
- Topic and thread owners do not reuse whole-chat coverage unless provenance
  proves that the whole-chat source includes that owner.
- Dashboard components do not call `telegram.getMessages` from ready or failed
  event handlers.

### Reconciler

- Same selector creates one durable job.
- Stale `running` jobs return to `queued` after lock timeout.
- `deferred` jobs return to `queued` after `nextRunAt`.
- Reconciler skips a job that became covered before execution.
- Reconciler fetches more than one TDLib page when required.
- Reconciler treats public `beforeMessageId` as exclusive even though TDLib
  includes `from_message_id` with `offset = 0`.
- Reconciler does not publish ready after a single partial page.
- Reconciler publishes ready only after selector readiness passes.
- Reconciler publishes failed with a bounded reason.
- Reconciler routes each owner kind to the correct internal TDLib operation.
- Reconciler handles owners without dedicated date anchors by paging until
  selector readiness or owner-history beginning.
- Reconciler ignores null TDLib message entries.
- Reconciler does not use approximate TDLib `total_count` as readiness proof.
- A TDLib page smaller than the private limit does not by itself prove owner
  history beginning.
- Reconciler does not call per-message file slot recording.
- Reconciler does not wait for file slot materialization before writing
  coverage or publishing ready.
- FileSubsystem materializes stored message slots asynchronously and marks
  messages with no files as processed.
- File slot materialization does not block ready event on file download
  completion.

### Observability

- Metrics contain only approved labels.
- Metrics never contain `requestId`, owner key, `chatId`, message id, raw
  timestamps, or raw ranges.
- Spans use stable names.
- Production span attributes do not contain `requestId`, owner key, `chatId`,
  message id, raw timestamps, or raw ranges.
- The metric contract does not add `telegram.history.reconciler.jobs.processed`.
- Job decisions emit bounded logs.

### File Layout

- Public procedure orchestration stays thin.
- Owner normalization, coverage, job state, TDLib paging, telemetry, and local
  reads live in their documented files.
- New internal types are not exported through the package root without a current
  external consumer.
- No file accumulates unrelated procedure, coverage, TDLib, job, and telemetry
  responsibilities.
- New tests live under `packages/telegram/tests` and mirror the production path
  after `src`.
- New tests are not added under `packages/telegram/src`.

## Verification Checklist

Keep these concrete facts true in code:

- Live coverage is still a strict readiness guarantee.
- Coverage storage and subtraction are owner-scoped, not only chat-scoped.
- Current TDLib operation wrapper supports the needed owner-specific id-cursor
  loops.
- Owner resolution can map Saved Messages topic, direct-message topic, forum
  topic, and message thread owners to local read filters and TDLib operations.
- Existing coverage subtraction handles fragmented coverage for requested
  intervals.
- Existing file slot recording can be called without waiting for file downloads.
- Stored messages have a durable marker that supports async FileSubsystem slot
  materialization without repeatedly processing messages that have no files.
- Existing event stream is enough for Dashboard to update pending/request state
  from `telegram.messages.ready` and `telegram.messages.failed` without
  procedure calls from broad event handlers.
