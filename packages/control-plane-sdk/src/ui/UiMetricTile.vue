<script setup lang="ts">
defineProps<{
  detail?: string | undefined;
  label: string;
  value: string;
}>();
</script>

<template>
  <div class="ui-metric-tile">
    <div class="ui-metric-tile__label">{{ label }}</div>
    <div class="ui-metric-tile__value">{{ value }}</div>
    <div v-if="detail" class="ui-metric-tile__detail">{{ detail }}</div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.ui-metric-tile {
  @apply min-w-0;
}

.ui-metric-tile__label {
  @apply text-sm text-zinc-500;
}

.ui-metric-tile__value {
  @apply mt-1 truncate text-2xl font-semibold;
}

.ui-metric-tile__detail {
  @apply mt-2 text-xs text-zinc-500;
}
</style>
