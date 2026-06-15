# Gap Restore

- This folder owns Telegram startup history gap restore planning and execution.
- Keep policy resolution in `packages/telegram/policies`.
- Keep durable coverage reads and writes in `src/history` and `src/reconciler`.
- Execute history requests only through the existing `getMessages` procedure
  contract.
