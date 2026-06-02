# Model References

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one appears necessary, stop and report the boundary violation before editing code.

- This folder owns stable internal model reference helpers.
- Keep refs independent from TDLib clients and database query logic.
- String model identifiers may contain the persisted `telegram.*` namespace;
  local TypeScript identifiers must stay package-local and avoid package-name
  prefixes.
