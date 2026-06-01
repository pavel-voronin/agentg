# Status

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one appears necessary, stop and report the boundary violation before editing code.

- This folder owns the Telegram module status resource.
- Keep status state, status resource types, and status factories here.
- Other folders may consume the status resource through explicit resource
  parameters, but must not declare status types or create status instances.
- Do not add TDLib ingestion, file, database, history, or UI logic here.
