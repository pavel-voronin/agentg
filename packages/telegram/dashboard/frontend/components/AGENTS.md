# Telegram Dashboard Components

- This folder contains browser-only Vue components for Telegram Dashboard.
- Do not import backend code, Telegram runtime code, TDLib code, storage code,.
- Vue components must use `<script setup lang="ts">` and `<style scoped>`.
- Keep components focused and small. If a component grows beyond one clear UI
  responsibility, split it into child components and move non-render logic to
  browser-only helpers or composables in the parent frontend folder.
- Keep copied timeline UI behavior intact unless the user explicitly approves a UI redesign.
