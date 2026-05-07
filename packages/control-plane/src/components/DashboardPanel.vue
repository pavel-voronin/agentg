<script setup lang="ts">
import { SlotOutlet } from '@agentg/control-plane-sdk/slots';

type DashboardTile = {
  label: string;
  slotId: string;
};

const tiles = [
  {
    label: 'Tile 1',
    slotId: 'control-plane.dashboard.tile.1'
  },
  {
    label: 'Tile 2',
    slotId: 'control-plane.dashboard.tile.2'
  },
  {
    label: 'Tile 3',
    slotId: 'control-plane.dashboard.tile.3'
  },
  {
    label: 'Tile 4',
    slotId: 'control-plane.dashboard.tile.4'
  }
] satisfies readonly DashboardTile[];
</script>

<template>
  <div class="dashboard-panel">
    <div v-for="tile in tiles" :key="tile.slotId" class="dashboard-panel__tile">
      <SlotOutlet :slot-id="tile.slotId" :tags="['control-plane.dashboard.tile']">
        <div class="dashboard-panel__empty-tile">
          <div class="dashboard-panel__empty-label">{{ tile.label }}</div>
          <div class="dashboard-panel__empty-value">-</div>
          <div class="dashboard-panel__empty-detail">empty</div>
        </div>
      </SlotOutlet>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.dashboard-panel {
  @apply grid grid-cols-4 overflow-hidden rounded-lg border border-zinc-200 bg-white;
}

.dashboard-panel__tile {
  @apply border-r border-zinc-200 p-4 last:border-r-0;
}

.dashboard-panel__empty-tile {
  @apply min-w-0;
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
