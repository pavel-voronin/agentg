# History Sync Control Plane Frontend

- This folder owns History Sync Control Plane Vue components and browser-only
  view helpers.
- Vue components must use `<script setup lang="ts">` and scoped styles.
- Control Plane procedure calls must go through `useControlPlaneHost()`.
- History Sync may render in Telegram client slots through neutral Control
  Plane slot tags, but it must not import Telegram frontend code.
