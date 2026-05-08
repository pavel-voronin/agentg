# Project Rules

- Use conventional commits.
- Use only these commit scopes: `project`, `infra`, `telegram`, `history`,
  `gateway`, `control-plane`, `summaries`, `extensions`, `storage`, `rpc`, and
  `events`.
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
- Vue component styling must be scoped to the component. Every Vue component
  style block must use `<style scoped>`, and component templates may assign only
  one semantic CSS class per element. Tailwind utilities belong inside the
  component's scoped style block via `@apply`; Tailwind `@reference` directives
  are allowed only to make `@apply` work inside scoped style blocks. Inline
  Tailwind utility lists, unscoped component styles, ordinary CSS declarations,
  and domain-level global CSS imports are forbidden.

## Control Plane Procedure Calls

- Control Plane must not call procedures after initialization unless there is
  clear user intent. User intent includes direct UI actions such as clicking a
  button, changing an input, selecting an item, or an explicit user instruction
  that requires a procedure call.
- Timers, polling loops, broad event triggers, lifecycle hooks, and background
  refreshes must not call domain procedures from Control Plane or from
  Control Plane components provided by domains.
- Control Plane UI must stay live from incoming events. Domains are responsible
  for publishing every significant state change needed by Control Plane, and
  Control Plane components must subscribe to those events and update local UI
  state from them.
- This rule applies at every Control Plane layer: the Control Plane shell,
  shared Control Plane SDK components, and all domain-provided Control Plane
  content.
- Initialization calls are allowed only for the data required to mount or
  hydrate the initial view. Do not expand initialization into a recurring or
  trigger-driven refresh mechanism.

## Communication Rules

- When the user asks about an architectural decision, present viable options and
  mark one option as the preferred recommendation. The user makes the decision.
- Do not present an assistant recommendation as a final decision unless the user
  has explicitly selected it.
- Once the user selects an option, treat that option as the current decision and
  do not keep re-listing alternatives unless the user asks or new information
  invalidates the selected direction.
- Answer binary technical questions directly: yes or no, stays or does not stay,
  allowed or forbidden.
- Treat user questions as requests for an answer only. Do not edit files, run
  implementation steps, or change code in response to a question unless the user
  explicitly asks for changes.
- Call out architectural risks immediately and explicitly. Do not bury them in
  neutral prose.
- If a response lists alternatives for context, it must still name the preferred
  recommendation and explain why it is preferred.
- Do not use the Russian words "почти" or "примерно" in assistant replies.
- Do not use uncertainty markers such as "возможно", "вероятно",
  "наверное", "скорее всего", or substitute vague phrasing when the answer can
  be verified directly.
- When a response would need an uncertainty marker for code, numbers, values,
  existing architecture, current behavior, or another concrete fact, spend the
  extra tokens to inspect the source, run the command, count, or otherwise
  verify the information before answering.
