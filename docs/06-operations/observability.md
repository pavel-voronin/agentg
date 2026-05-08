# Observability

## Metrics To Track

- updates ingested per chat
- normalization failures
- live update lag
- history target coverage per chat
- missing history intervals per chat
- backfill job queue depth and age
- failed TDLib requests
- Postgres write latency
- duplicate event count
- attachment metadata count
- active Service Directory services and extensions per target
- RPC call lifecycle by `callId`
- module-owned event counts by slug prefix

## Debug Views

The system should support answering:

- Is the Telegram session authenticated?
- Which chats have been discovered?
- Which history targets exist for a chat?
- Which intervals are covered or missing for a chat?
- Which backfill jobs are running?
- When was the last update received?
- Was a specific Telegram message persisted?
- Which raw event produced a specific current message record?
- Which extension getters are active for a model target such as `telegram.chat`?
- Did an RPC call start, report progress, complete, or fail for a given
  `callId`?

## RPC Call Events

RPC methods publish these live events by default:

The event name is `{domain}.rpc.{procedure}.{lifecycle}`. For target
`history.getChatHistoryState`, the lifecycle events are:

- `history.rpc.getChatHistoryState.started`
- `history.rpc.getChatHistoryState.progress`
- `history.rpc.getChatHistoryState.completed`
- `history.rpc.getChatHistoryState.failed`

The `callId` is stored in `event.data.callId`. These events are ephemeral and
should be used for live debugging, not recovery.

## Source Audits

`npm run source:audit` checks boundary rules that are easy to regress during
module work:

- raw tRPC builder imports stay package-local
- cross-domain storage schema imports stay out of runtime code
- domain and module table prefixes match ownership
- Gateway's external RPC and event surface remains covered
- domain runtime code does not reintroduce `enriched`
- History and Telegram do not expose local extension registries
- Service Directory server code does not call service RPC methods
