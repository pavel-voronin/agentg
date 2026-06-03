# Observability

## Metrics To Track

- updates ingested per chat
- normalization failures
- live update lag
- Telegram history coverage per chat
- missing history intervals per chat
- History Sync pass duration and requested interval counts
- Telegram history coverage ensure page counts and remaining interval counts
- failed TDLib requests
- Postgres write latency
- malformed or unhandled TDLib update count
- attachment metadata count
- active Service Directory services and extensions per target
- RPC call lifecycle by `callId`
- module-owned event counts by slug prefix

## Debug Views

The system should support answering:

- Is the Telegram session authenticated?
- Which chats have been discovered?
- Which history sync targets exist for a chat?
- Which target intervals are covered or missing for a chat?
- Which Telegram coverage intervals exist for a chat?
- When was the last update received?
- Was a specific Telegram message persisted?
- Which update handler or table write explains a specific Telegram input?
- Which extension getters are active for a model target such as `telegram.chat`?
- Did an RPC call start, report progress, complete, or fail for a given
  `callId`?

## RPC Call Events

RPC methods publish these live events by default:

The event name is `{domain}.rpc.{procedure}.{lifecycle}`. For target
`history-sync.getChatHistorySyncState`, the lifecycle events are:

- `history-sync.rpc.getChatHistorySyncState.started`
- `history-sync.rpc.getChatHistorySyncState.progress`
- `history-sync.rpc.getChatHistorySyncState.completed`
- `history-sync.rpc.getChatHistorySyncState.failed`

The `callId` is stored in `event.data.callId`. These events are ephemeral and
should be used for live debugging, not recovery.

## Source Audits

`npm run source:audit` checks boundary rules that are easy to regress during
module work:

- cross-domain storage schema imports stay out of runtime code
- domain and module table prefixes match ownership
- Gateway's external RPC and event surface remains covered
- domain runtime code does not reintroduce `enriched`
- History Sync and Telegram do not expose local extension registries
- Service Directory server code does not call service RPC methods
