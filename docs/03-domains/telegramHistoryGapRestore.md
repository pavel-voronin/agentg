# Telegram History Gap Restore

## Purpose

Telegram history gap restore requests bounded pre-live history windows for
Telegram chats when the Telegram module starts.

The core contract is: `gapRestore` evaluates Telegram-owned policy rules for
available stored chats, computes bounded range requests, and calls the existing
Telegram `getMessages` procedure.

## Vocabulary

`live coverage` is the existing Telegram mechanism that proves the current
online interval for known chats.

`gap` is any missing history interval inside the requested pre-live window for a
chat.

`windowSeconds` is the width of the pre-live range requested for one matching
chat during one startup run.

## Policy Kind And Files

Policy kind:

```text
TelegramHistoryGapRestoreRule
```

Policy definition:

```text
packages/telegram/policies/policies.ts
```

Policy documents:

```text
config/policies/telegram-history-gap-restore-rule
```

Runtime:

```text
packages/telegram/src/gap-restore
```

## Policy Spec

Enable restore for future and existing channels:

```yaml
apiVersion: agentg.dev/v1
kind: TelegramHistoryGapRestoreRule
metadata:
  name: channelsLastDay
spec:
  chatTypes: [channel]
  restore: true
  windowSeconds: 86400
```

Disable restore for private chats:

```yaml
apiVersion: agentg.dev/v1
kind: TelegramHistoryGapRestoreRule
metadata:
  name: privateDisabled
spec:
  chatTypes: [private]
  restore: false
```

Enable restore for concrete chats:

```yaml
apiVersion: agentg.dev/v1
kind: TelegramHistoryGapRestoreRule
metadata:
  name: selectedChatsLastDay
spec:
  chatIds:
    - '-1001234567890'
  restore: true
  windowSeconds: 86400
```

Enable restore for all chats:

```yaml
apiVersion: agentg.dev/v1
kind: TelegramHistoryGapRestoreRule
metadata:
  name: allChatsLastHour
spec:
  restore: true
  windowSeconds: 3600
```

Spec rules:

- `restore` is required.
- `restore: true` requires `windowSeconds`.
- `restore: false` forbids `windowSeconds`.
- `windowSeconds` must be a positive integer.
- `chatTypes` and `chatIds` are optional.
- a spec without `chatTypes` and without `chatIds` matches all chats.
- `chatTypes` and `chatIds` must not appear together.
- `chatTypes` and `chatIds`, when present, must be non-empty arrays with unique
  values.
- `chatIds` are canonical string Telegram chat ids as stored by the Telegram
  domain. Numeric YAML values must not be coerced into chat ids.
- `chatTypes` values are Telegram domain chat types, not raw TDLib constructor
  names.

## Chat Types

Allowed policy chat types:

```ts
['private', 'secret', 'group', 'channel'];
```

Telegram maps stored TDLib chat types into that enum:

- `chatTypePrivate` -> `private`;
- `chatTypeSecret` -> `secret`;
- `chatTypeBasicGroup` -> `group`;
- `chatTypeSupergroup` with `is_channel !== true` -> `group`;
- `chatTypeSupergroup` with `is_channel === true` -> `channel`.

`chatTypes` is evaluated against the chat type at startup. A future chat that is
stored later as `group` matches `chatTypes: [group]` on the next startup. A
future private chat does not match that rule.

## Restorable Chats

`gapRestore` only plans work for restorable chats.

A stored chat is restorable when:

- its stored TDLib chat type maps to one of the Telegram policy chat types;
- `telegram_chats.chat_lists` is a JSON array with at least one element.

The `chat_lists` requirement is the local availability contract for startup
restore planning. Rows with `chat_lists = null`, a non-array `chat_lists` value,
or an empty `chat_lists` array are not restorable.

This filter is applied before policy resolution. Therefore:

- an all-chats rule matches all restorable chats only;
- a `chatTypes` rule matches restorable chats of those types only;
- a `chatIds` rule does not bypass availability. A concrete unavailable chat id
  creates no restore request.

`gapRestore` does not perform a per-chat TDLib availability check during
planning.

## Concrete Resolution

The `TelegramHistoryGapRestoreRule` resolver builds a rule table from active
specs.

Each spec expands into atomic keys:

- no `chatTypes` and no `chatIds` -> `all`;
- `chatTypes: [group, channel]` -> `chatType:group`, `chatType:channel`;
- `chatIds: ['-1001234567890']` -> `chatId:-1001234567890`.

Each atomic key stores one decision:

```ts
type GapRestoreDecision = { kind: 'disabled' } | { kind: 'enabled'; windowSeconds: number };
```

Conflicting decisions for the same atomic key are invalid. Same-key duplicates
with identical decisions are allowed but add no behavior.

At runtime, a chat is matched in this order:

1. `chatId:<chatId>`
2. `chatType:<chatType>`
3. `all`

The first matching key is the effective decision. If no key matches, restore is
disabled for that chat.

Examples:

- `all` enables restore and `chatType:private` disables it: private chats are
  disabled, other chats are enabled.
- `chatType:group` enables restore and `chatId:x` disables it: chat `x` is
  disabled, other groups are enabled.
- `chatType:private` disables restore and `chatId:x` enables it: chat `x` is
  enabled.

## Startup Runtime

`gapRestore` runs once during Telegram module startup.

It runs after:

1. Telegram authentication has completed;
2. the current live coverage window has been opened;
3. initial chats have been synced into Telegram storage;
4. known chats have been registered in live coverage.

The intended placement is inside Telegram ingestion startup after initial chat
sync and after the final live coverage sync.

`gapRestore` does not run from a timer, does not poll, and does not start new
work on policy update events. Updated policies affect the next startup run.

Invalid policy documents fail policy resolution before runtime planning.

Per-chat `getMessages` exceptions are recorded as request failures and do not
prevent planning from continuing for the remaining chats. If at least one
per-chat request failed, the startup run summary result is `failed`.

Systemic failures before per-chat planning, such as being unable to read stored
chats or current live coverage state, fail the startup run immediately.

## Range Planning

For each restorable chat:

1. normalize the chat type to the Telegram policy enum;
2. resolve the effective decision for the chat id and chat type;
3. skip the chat when no rule matches or the effective decision is disabled;
4. read the current live coverage boundary for the chat;
5. compute the bounded pre-live range;
6. call `getMessages` with that range.

Planner output:

```ts
type GapRestorePlan =
  | { kind: 'skip'; reason: GapRestoreSkipReason }
  | { kind: 'request'; input: GetMessagesInput };
```

Skip reasons:

- `noMatchingRule`;
- `restoreDisabled`;
- `missingLiveBoundary`;
- `emptyRange`;
- `invalidChatType`.

The range selector uses existing `getMessages` range semantics: `[startAt,
endAt)`. `startAt` is inclusive, `endAt` is exclusive, and `startAt >= endAt`
is an empty range.

For an enabled chat:

```text
endAt = live coverage start
startAt = live coverage start - windowSeconds
```

The planner does not inspect durable coverage and does not shrink the range by
existing coverage. The range is a request window, not one missing interval. It
can contain zero, one, or many coverage gaps. The `getMessages` procedure
fulfills the requested range according to its own contract.

## getMessages Call

`gapRestore` calls the existing `getMessages` procedure directly.

Input:

```ts
{
  owner: { kind: 'chat', chatId },
  selector: {
    kind: 'range',
    startAt,
    endAt
  }
}
```

Call:

```ts
await getMessages(input);
```

For `gapRestore`, `getMessages` is a procedure callable. `gapRestore` observes
only the procedure output or a thrown exception.

Outputs with `status: 'ready'` and `status: 'pending'` both count as successful
delegation. A thrown exception is a per-chat request failure.

## Live Coverage Boundary

Live coverage is not controlled by `TelegramHistoryGapRestoreRule`.

`gapRestore` only reads live coverage as the measurement layer that defines
where the pre-live request window ends.

The boundary is chat-specific. It is derived from the existing live coverage
read model, including the chat's `eligibleFrom` registration and live coverage
windows. The selected boundary is the start of the live coverage segment that
proves current coverage for that chat during this startup run.

If the live coverage read model contains no usable current segment for the chat,
the planner returns `skip(missingLiveBoundary)`.

## Storage

Gap restore does not introduce new durable planning state.

It reads stored chats and live coverage state. It delegates history range
fulfillment to the `getMessages` procedure.

## Tests

Required test coverage:

- policy schema accepts enabled and disabled specs;
- policy schema rejects `restore: true` without `windowSeconds`;
- policy schema rejects `restore: false` with `windowSeconds`;
- policy schema rejects specs that contain both `chatTypes` and `chatIds`;
- policy schema rejects empty or duplicate `chatTypes` and `chatIds`;
- concrete resolution applies specificity order `chatIds` > `chatTypes` > all
  chats;
- concrete resolution rejects conflicting decisions for the same atomic key;
- concrete resolution expands multi-value specs into atomic keys;
- no matching rule disables restore;
- candidate selection ignores stored chats whose `chat_lists` value is null,
  non-array, or an empty array;
- candidate selection applies before `all`, `chatTypes`, and `chatIds` matching;
- planner requests the full bounded pre-live range from live boundary and
  `windowSeconds`;
- planner does not read durable coverage and does not shrink the range by
  existing coverage;
- planner skips disabled chats;
- planner skips chats without live coverage boundary;
- runtime calls the `getMessages` procedure with a range selector;
- runtime reports ready and pending `getMessages` outputs as successful
  delegation;
- runtime records per-chat `getMessages` exceptions and continues planning;
- startup runs gap restore once after initial chat sync and live coverage sync.
