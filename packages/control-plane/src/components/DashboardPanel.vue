<script setup lang="ts">
import { SlotOutlet } from '@agentg/control-plane-sdk/slots';
</script>

<template>
  <div class="dashboard-panel">
    <SlotOutlet
      class="dashboard-panel__tile"
      slot-id="control-plane.dashboard.tiles"
      :tags="['control-plane.dashboard.tile']"
    >
      <div class="dashboard-panel__empty-tile">
        <div class="dashboard-panel__empty-label">Dashboard</div>
        <div class="dashboard-panel__empty-value">-</div>
        <div class="dashboard-panel__empty-detail">empty</div>
      </div>
    </SlotOutlet>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.dashboard-panel {
  @apply grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] overflow-hidden rounded-lg border border-zinc-200 bg-white;
}

.dashboard-panel :deep(.dashboard-panel__tile),
.dashboard-panel__empty-tile {
  @apply min-w-0 border-r border-zinc-200 bg-white p-4 last:border-r-0;
}

.dashboard-panel :deep(.dashboard-panel__tile) {
  @apply h-full;
}

.dashboard-panel__empty-label {
  @apply text-sm text-zinc-500;
}

.dashboard-panel__empty-value {
  @apply mt-1 truncate text-2xl font-semibold;
}

.dashboard-panel__empty-detail {
  @apply mt-2 text-xs text-zinc-500;
}
</style>
