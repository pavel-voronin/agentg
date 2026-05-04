<script setup lang="ts">
import type { DashboardMetric } from '../stores/controlPlaneTypes.js';

defineProps<{
  metrics: DashboardMetric[];
}>();
</script>

<template>
  <div class="grid grid-cols-4 gap-3">
    <div
      v-for="metric in metrics"
      :key="metric.label"
      class="rounded-lg border border-zinc-200 bg-white p-3"
    >
      <div class="text-xs text-zinc-500">{{ metric.label }}</div>
      <div class="mt-1 truncate text-2xl font-semibold">{{ metric.value }}</div>
      <div v-if="metric.detail" class="mt-1 truncate text-xs text-zinc-500">
        {{ metric.detail }}
      </div>
    </div>
  </div>
</template>
