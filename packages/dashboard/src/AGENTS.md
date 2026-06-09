# Source Rules

- This source tree contains only the new Dashboard implementation.
- Do not add compatibility branches for old Dashboard, old service
  directory, deleted module RPC, or provider asset proxy behavior.
- The browser app uses direct Vite imports for discovered provider components.
- The server proxies procedure calls by looking up procedure URLs from
  `registry`.
- New Vue components must use `<script setup lang="ts">` and `<style scoped>`.
