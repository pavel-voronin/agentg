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

## Communication Rules

- When the user asks for an architectural decision, give one selected decision.
  Do not replace the decision with a menu of options.
- State hard boundaries as hard rules. Do not soften them with vague wording.
- Answer binary technical questions directly: yes or no, stays or does not stay,
  allowed or forbidden.
- Call out architectural risks immediately and explicitly. Do not bury them in
  neutral prose.
- If a response lists alternatives for context, it must still name the selected
  option and explain why that option wins.
