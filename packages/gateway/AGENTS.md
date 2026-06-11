# Gateway Rules

- This package is the current external Gateway module built on
  `@agentg/framework`.
- Keep the external WebSocket protocol isolated in `src/server.ts`.
- Gateway must not import Telegram implementation files. It may call Telegram
  only through the typed client exported by `@agentg/telegram`.
- Gateway forwards only explicitly selected external events. Do not add broad
  event forwarding.
- Every new folder in this package must include its own `AGENTS.md` before code
  is added there.
