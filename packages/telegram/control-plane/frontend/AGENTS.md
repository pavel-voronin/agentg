# Control Plane Frontend

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one appears necessary, stop and report the boundary violation before editing code.

- This folder owns Telegram Control Plane Vue components and browser-only view
  helpers.
- Keep backend procedures, storage writes, TDLib operations, and Node-only code
  out of this folder.
- Vue components must use `<script setup lang="ts">` and scoped styles.
- Do not create or keep large all-in-one Vue components. Split components as
  soon as a file owns more than rendering and light composition: move RPC/event
  state into composables, response decoding and view-model building into plain
  helpers, and repeated UI blocks into focused child components.
- Components should be as small as the responsibility boundary allows. A large
  component file needs an explicit domain reason; visual convenience or keeping
  related code nearby is not enough.
- Control Plane procedure calls must go through `useControlPlaneHost()`.
