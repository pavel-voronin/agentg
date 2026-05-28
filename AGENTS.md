# Project Rules

- Use conventional commits.
- Use only these commit scopes: `project`, `infra`, `telegram`, `history-sync`,
  `gateway`, `control-plane`, `extensions`, `storage`, `rpc`, and
  `events`.
- Project-owned directories must use kebab-case. Project-owned file names must
  use camelCase stems; `.test`, `.config`, and `.d` are allowed only as
  technical suffixes after the camelCase stem. The only allowed exceptions are
  external tool or platform contract names: `AGENTS.md`, `Dockerfile`,
  `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.js`,
  `docker-compose.yml`, `vite.config.ts`, `drizzle.config.ts`, dotfiles, and
  generated Drizzle migration/meta files. Do not add new exceptions or
  differently-cased names; rename the file or directory instead.
- Do not introduce technical debt, fallback paths, compatibility paths, legacy
  paths, or parallel old/new implementations.
- Do not keep alternative architecture artifacts or documentation for replaced
  behavior. Current architecture docs must describe only the current target
  architecture.
- The repository must have at most one active working plan. The only allowed
  active plan file is `PLAN.md` at the repository root. Before creating or
  replacing a working plan, remove obsolete active plan files elsewhere in the
  repository. `PLAN.md` is a temporary execution artifact, not long-term
  architecture documentation.
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

## Domain Boundary Rules

- Never propose, list, or implement options that mix domain ownership.
- Before presenting alternatives, discard any option that violates domain
  boundaries. Do not show rejected boundary-violating options for context.
- A domain must not reference another domain's content IDs, procedures, events,
  view state, labels, tab names, layout positions, or implementation details.
- Cross-domain UI composition is allowed only through neutral Control Plane SDK
  or extension contracts. Domains may publish contributions; other domains may
  render only generic contributions without knowing the contributing domain.
- Existing domain coupling must not be extended. If a requested change touches
  existing coupling, propose a replacement that removes or isolates the coupling
  through a neutral contract.
- A domain must not export procedure-specific `Input`/`Output` DTO types for
  other domains. Cross-domain procedure access must go through a typed client or
  a local domain port; procedure schemas and DTO names stay inside the owning
  domain.
- Domain RPC clients must be produced by `defineInternalRpcDomain`. Do not add
  domain-owned client facade files that mechanically wrap every procedure.
- If every apparent implementation path requires domain mixing, stop and re-plan
  instead of offering it as an option.

## Communication Rules

- A user question is a request for an answer only.
- Do not interpret questions as implementation requests, bug reports requiring
  changes, or implicit permission to edit files.
- Do not start code changes, file edits, refactors, tests, commits, or
  implementation work unless the user gives an explicit action instruction.
- Explicit action instructions include direct commands such as "change", "edit",
  "implement", "fix", "remove", "add", "commit", "run", or equivalent wording.
- If the user asks why something works a certain way, explain the current
  behavior and the reasoning. Do not change the behavior unless explicitly
  instructed.
- If the user points out a problem in a question, answer the question first. Do
  not treat the problem statement as authorization to fix it.
- If the user's intent is ambiguous, default to answering only. Ask for
  confirmation before making changes.
- Do not treat frustrated wording, criticism, or direct language as an
  implementation request. Respond to the technical content only.
- When the user asks about an architectural decision, present viable options and
  mark one option as the preferred recommendation. The user makes the decision.
- When the user asks for architectural judgment, do not merely restate the
  user's proposed options. Give an independent engineering recommendation,
  include any stronger option the user did not name, and explain the objective
  reason in direct terms.
- For architecture trade-off questions, lead with the recommended pattern or
  decision, then give concise trade-offs. Treat the user's options as context,
  not as the full solution space.
- Prefer durable engineering patterns over personality-aware answers. Name the
  boundary, contract, scaling property, or failure mode that makes the
  recommendation correct.
- When the user asks for judgment, act from accumulated engineering pattern
  knowledge rather than conversational deference. Do not optimize for agreement
  with the user's framing. State the pattern you would choose if no human
  preference had been expressed, and why.
- If the user has already listed options, treat them as evidence, not as a menu.
  You may reject the framing and introduce a better pattern when the technical
  problem calls for it.
- Do not present architecturally forbidden designs as viable options. When
  listing alternatives, include only options that satisfy project rules and
  domain boundaries.
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
- Do not use the Russian words "почти", "примерно", or "частично" in assistant
  replies.
- Do not use uncertainty markers such as "возможно", "вероятно",
  "наверное", "скорее всего", or substitute vague phrasing when the answer can
  be verified directly.
- When a response would need an uncertainty marker for code, numbers, values,
  existing architecture, current behavior, or another concrete fact, spend the
  extra tokens to inspect the source, run the command, count, or otherwise
  verify the information before answering.
