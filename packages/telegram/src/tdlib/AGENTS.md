# TDLib Boundary

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one appears necessary, stop and report the boundary violation before editing code.

- This folder owns small helpers for TDLib-shaped values used by the current
  module.
- Do not recreate the old `TelegramWire*` alias layer.
- Use `tdlib-types` as the source of TDLib object types.
- Keep runtime clients, ingestion, persistence, files, and UI code out of this
  folder.
- Operation helpers may publish lifecycle events through the framework event bus.
- Do not import through `@agentg/telegram`.
