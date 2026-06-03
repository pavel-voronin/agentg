# History Sync Frontend Components

- This folder contains History Sync Control Plane Vue components.
- Keep components small and split by visible responsibility.
- Do not import backend code, Telegram runtime code, TDLib code, storage code, or
  deleted old-contour packages.
- Vue components must use `<script setup lang="ts">` and `<style scoped>`.
