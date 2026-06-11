# History Sync Dashboard Frontend

- This folder owns History Sync Dashboard Vue components and browser-only
  view helpers.
- Vue components must use `<script setup lang="ts">` and scoped styles.
- Dashboard procedure calls must go through the local typed API wrapper.
- Components and feature composables must not call `host.rpc(...)` directly.
- History Sync may render in Telegram client slots through neutral Control
  Plane slot tags, but it must not import Telegram frontend code.
