<script setup lang="ts">
import { SlotOutlet } from '@agentg/framework/cp';
</script>

<template>
  <div class="home-page-content">
    <SlotOutlet
      class="home-page-content__tile"
      slot-id="control-plane.dashboard.tiles"
      :tags="['control-plane.dashboard.tile']"
    >
      <div class="home-page-content__empty-tile">
        <div class="home-page-content__empty-label">Dashboard</div>
        <div class="home-page-content__empty-value">-</div>
        <div class="home-page-content__empty-detail">empty</div>
      </div>
    </SlotOutlet>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.home-page-content {
  @apply grid w-full grid-cols-[repeat(auto-fit,minmax(220px,1fr))] self-start overflow-hidden rounded-lg border border-zinc-200 bg-white;
}

.home-page-content :deep(.home-page-content__tile),
.home-page-content__empty-tile {
  @apply min-w-0 border-r border-zinc-200 bg-white p-4 last:border-r-0;
}

.home-page-content__empty-label {
  @apply text-sm text-zinc-500;
}

.home-page-content__empty-value {
  @apply mt-1 truncate text-2xl font-semibold;
}

.home-page-content__empty-detail {
  @apply mt-2 text-xs text-zinc-500;
}
</style>
