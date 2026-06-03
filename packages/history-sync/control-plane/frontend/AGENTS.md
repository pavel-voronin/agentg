# History Sync Control Plane Frontend

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as
  `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one
  appears necessary, stop and report the boundary violation before editing code.

- This folder owns History Sync Control Plane Vue components and browser-only
  view helpers.
- Vue components must use `<script setup lang="ts">` and scoped styles.
- Control Plane procedure calls must go through `useControlPlaneHost()`.
- History Sync may render in Telegram workspace slots through neutral Control
  Plane slot tags, but it must not import Telegram frontend code.
