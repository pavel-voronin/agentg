<script setup lang="ts">
import type { PageView } from '../report/reportView.js';

type SampleRow = PageView['slowestRows'][number];

defineProps<{
  droppedRecords: string;
  ignoredRecords: string;
  rows: readonly SampleRow[];
  title: string;
}>();
</script>

<template>
  <section class="samples-list">
    <div class="samples-list__section-header">
      <h3 class="samples-list__section-title">{{ title }}</h3>
      <div class="samples-list__section-meta">
        ignored {{ ignoredRecords }} / dropped {{ droppedRecords }}
      </div>
    </div>
    <div class="samples-list__samples">
      <div
        v-for="sample in rows"
        :key="sample.key"
        class="samples-list__sample"
        :data-ok="sample.ok ? 'true' : 'false'"
      >
        <div class="samples-list__sample-time">{{ sample.time }}</div>
        <div class="samples-list__sample-body">
          <div class="samples-list__row-name">{{ sample.name }}</div>
          <div class="samples-list__row-source">{{ sample.source }}</div>
        </div>
        <div class="samples-list__sample-detail">{{ sample.detail }}</div>
        <div class="samples-list__sample-at">{{ sample.at }}</div>
      </div>
      <div v-if="rows.length === 0" class="samples-list__empty">No samples</div>
    </div>
  </section>
</template>

<style scoped>
@reference "tailwindcss";

.samples-list {
  @apply mt-6 border-t border-zinc-200 pt-4;
}

.samples-list__section-header {
  @apply mb-3 flex items-baseline justify-between gap-3;
}

.samples-list__section-title {
  @apply text-base font-semibold tracking-normal;
}

.samples-list__section-meta {
  @apply shrink-0 text-xs text-zinc-500;
}

.samples-list__samples {
  @apply divide-y divide-zinc-100;
}

.samples-list__sample {
  @apply grid grid-cols-[90px_minmax(0,1fr)_minmax(180px,0.7fr)_150px] gap-3 py-2 text-sm;
}

.samples-list__sample[data-ok='false'] {
  @apply bg-red-50;
}

.samples-list__sample-time {
  @apply whitespace-nowrap font-semibold tabular-nums text-zinc-950;
}

.samples-list__sample-body {
  @apply min-w-0;
}

.samples-list__row-name {
  @apply truncate font-medium text-zinc-900;
}

.samples-list__row-source {
  @apply mt-0.5 truncate text-xs text-zinc-500;
}

.samples-list__sample-detail {
  @apply break-words text-xs text-zinc-500;
}

.samples-list__sample-at {
  @apply truncate text-right text-xs text-zinc-500;
}

.samples-list__empty {
  @apply py-6 text-sm text-zinc-500;
}
</style>
