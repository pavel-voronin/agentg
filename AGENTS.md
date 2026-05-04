# Project Rules

- Use conventional commits.
- Do not introduce technical debt, fallback paths, compatibility paths, legacy
  paths, or parallel old/new implementations.
- Do not keep alternative architecture artifacts or documentation for replaced
  behavior. Current architecture docs must describe only the current target
  architecture.
- If a change appears to require a temporary compatibility layer, legacy branch,
  fallback behavior, or transitional duplicate implementation, stop and re-plan
  the change instead of implementing it.
- Ordinary procedures must return fresh direct results only. They must not wrap
  results in compatibility envelopes or preserve old response shapes.
