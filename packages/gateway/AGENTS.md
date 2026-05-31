# Gateway Rules

- This package is the current external Gateway module built on
  `@agentg/framework`.
- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as
  `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one
  appears necessary, stop and report the boundary violation before editing code.
- Keep the external WebSocket protocol isolated in `src/server.ts`.
- Gateway must not import Telegram modules directly. It may call Telegram only
  through the framework RPC client returned by `rpc('telegram')`.
- Gateway forwards only explicitly selected external events. Do not add broad
  event forwarding or registry-manifest event exposure.
- Every new folder in this package must include its own `AGENTS.md` before code
  is added there.
