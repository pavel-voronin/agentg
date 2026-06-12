# Get Messages Procedure

- This folder owns the internal implementation of the public
  `telegram.getMessages` procedure.
- Keep the public operation as a Telegram domain capability: callers ask for
  messages by owner and selector and receive either `ready` messages or a
  `pending` request id.
- Do not expose TDLib operations, storage coverage, worker controls, file
  download mechanics, or reconciler strategy in this procedure contract.
- This folder may read local storage and enqueue the Telegram history
  reconciler. It must not call TDLib or the file subsystem directly.
- Procedure-specific schemas and DTO types stay here unless a real current
  Telegram-owned consumer needs them by direct internal import.
