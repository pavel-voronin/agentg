# Source Rules

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as
  `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one
  appears necessary, stop and report the boundary violation before editing code.
- This source tree contains only the current History Sync service.
- Telegram access goes through `module.rpc('telegram')` and public Telegram
  procedures. Do not import Telegram implementation files.
