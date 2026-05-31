# Runtime Rules

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one appears necessary, stop and report the boundary violation before editing code.

- Runtime code runs in the browser.
- Do not import Node-only modules.
- Provider content comes from `virtual:control-plane/providers`.
- Procedure calls go through the injected Control Plane host.
