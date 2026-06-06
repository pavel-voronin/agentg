<script setup lang="ts">
import type { PageView } from '../report/reportView.js';

defineProps<{
  view: PageView;
}>();
</script>

<template>
  <div class="overview-panel">
    <div class="overview-panel__summary-grid">
      <div v-for="card in view.summaryCards" :key="card.label" class="overview-panel__summary">
        <div class="overview-panel__summary-label">{{ card.label }}</div>
        <div class="overview-panel__summary-value">{{ card.value }}</div>
        <div class="overview-panel__summary-detail">{{ card.detail }}</div>
      </div>
    </div>

    <section v-if="view.signals.length > 0" class="overview-panel__section">
      <div class="overview-panel__section-header">
        <h3 class="overview-panel__section-title">Signals</h3>
        <div class="overview-panel__section-meta">current report window</div>
      </div>
      <div class="overview-panel__signal-grid">
        <div
          v-for="signal in view.signals"
          :key="signal.label"
          class="overview-panel__signal"
          :data-tone="signal.tone"
        >
          <div class="overview-panel__signal-label">{{ signal.label }}</div>
          <div class="overview-panel__signal-value">{{ signal.value }}</div>
          <div class="overview-panel__signal-detail">{{ signal.detail }}</div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.overview-panel {
  @apply min-w-0;
}

.overview-panel__summary-grid,
.overview-panel__signal-grid {
  @apply mt-4 grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3;
}

.overview-panel__summary,
.overview-panel__signal {
  @apply min-w-0 rounded border border-zinc-200 bg-white p-3;
}

.overview-panel__signal[data-tone='bad'] {
  @apply border-red-200 bg-red-50;
}

.overview-panel__signal[data-tone='warn'] {
  @apply border-amber-200 bg-amber-50;
}

.overview-panel__summary-label,
.overview-panel__signal-label {
  @apply text-xs font-medium text-zinc-500;
}

.overview-panel__summary-value {
  @apply mt-1 truncate text-lg font-semibold text-zinc-950;
}

.overview-panel__signal-value {
  @apply mt-1 break-words text-base font-semibold leading-snug text-zinc-950;
}

.overview-panel__summary-detail {
  @apply mt-1 truncate text-xs text-zinc-500;
}

.overview-panel__signal-detail {
  @apply mt-2 text-xs text-zinc-500;
}

.overview-panel__section {
  @apply mt-6 border-t border-zinc-200 pt-4;
}

.overview-panel__section-header {
  @apply mb-3 flex items-baseline justify-between gap-3;
}

.overview-panel__section-title {
  @apply text-base font-semibold tracking-normal;
}

.overview-panel__section-meta {
  @apply shrink-0 text-xs text-zinc-500;
}
</style>
