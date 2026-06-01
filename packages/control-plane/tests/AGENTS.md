# Control Plane Tests

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as
  `@agentg/events`, `@agentg/service-directory`,
  or `@agentg/database`.
- Tests here cover the current Control Plane shell, server, stores, view models,
  and SDK slot integration.
- Keep replaced behavior only as asserted user-facing behavior. Do not add
  compatibility adapters or deleted package imports.
