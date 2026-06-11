# Dashboard Components

- This folder contains shell-level Vue components only.
- Keep components small and split by visible responsibility; do not place stores,
  backend code, service clients, or domain-specific logic here.
- Vue components must use `<script setup lang="ts">` and `<style scoped>`.
- Component templates may assign only one semantic CSS class per element.
