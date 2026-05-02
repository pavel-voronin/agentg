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
- active Gateway capability registrations
- active extension registrations per enriched service
- observable RPC call lifecycle by `callId`
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
- Which module capabilities are currently active in Gateway?
- Which extensions are active for an enriched target?
- Did an observable call start, report progress, complete, or fail for a given
  `callId`?

## RPC Call Events

Observable and enriched RPC methods publish these live events:

- `rpc.call.started`
- `rpc.call.progress`
- `rpc.call.completed`
- `rpc.call.failed`

The `callId` is stored in `event.data.callId`. These events are ephemeral and
should be used for live debugging, not recovery.

## Source Audits

`npm run source:audit` checks boundary rules that are easy to regress during
module work:

- raw tRPC builder imports stay package-local
- cross-domain storage schema imports stay out of runtime code
- domain and module table prefixes match ownership
- Gateway capability registration and proxy behavior remain covered
