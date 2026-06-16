<script setup lang="ts">
import type { TimelineDetail, TimelineDetailSection } from '../../timeline/timelineModel.js';

const props = defineProps<{
  highlightedKeys: string[];
  sections: TimelineDetailSection[];
}>();

const emit = defineEmits<{
  clearHighlight: [];
  clearHover: [];
  detailFocus: [detail: TimelineDetail, event: Event];
  detailHover: [detail: TimelineDetail];
}>();

function isHighlighted(key: string): boolean {
  return props.highlightedKeys.includes(key);
}
</script>

<template>
  <div class="history-coverage-details-table">
    <section
      v-for="section in sections"
      :key="section.type"
      class="history-coverage-details-table__section"
    >
      <div class="history-coverage-details-table__title">{{ section.title }}</div>
      <div class="history-coverage-details-table__shell">
        <table class="history-coverage-details-table__table">
          <thead class="history-coverage-details-table__head">
            <tr class="history-coverage-details-table__head-row">
              <th class="history-coverage-details-table__heading">Start</th>
              <th class="history-coverage-details-table__heading">End</th>
              <th class="history-coverage-details-table__heading">Duration</th>
              <th class="history-coverage-details-table__heading">Messages</th>
            </tr>
          </thead>
          <tbody class="history-coverage-details-table__body">
            <tr
              v-for="detail in section.items"
              :key="detail.key"
              tabindex="0"
              class="history-coverage-details-table__row"
              :data-highlighted="isHighlighted(detail.key)"
              :data-type="detail.type"
              @blur="emit('clearHover')"
              @focus="emit('detailFocus', detail, $event)"
              @pointerenter="emit('detailHover', detail)"
              @pointerleave="emit('clearHighlight')"
            >
              <td class="history-coverage-details-table__monospace-cell">
                {{ detail.startValue }}
              </td>
              <td class="history-coverage-details-table__monospace-cell">
                {{ detail.endValue }}
              </td>
              <td class="history-coverage-details-table__muted-cell">{{ detail.duration }}</td>
              <td class="history-coverage-details-table__muted-cell">{{ detail.count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.history-coverage-details-table {
  @apply mt-3 grid gap-3;
}

.history-coverage-details-table__section {
  @apply grid gap-1;
}

.history-coverage-details-table__title {
  @apply text-xs font-semibold text-zinc-500;
}

.history-coverage-details-table__shell {
  @apply overflow-hidden rounded-lg border border-zinc-200;
}

.history-coverage-details-table__table {
  @apply w-full border-collapse text-left text-xs;
}

.history-coverage-details-table__head {
  @apply bg-zinc-50 text-zinc-500;
}

.history-coverage-details-table__heading {
  @apply px-3 py-2 font-semibold;
}

.history-coverage-details-table__body {
  @apply divide-y divide-zinc-100 bg-white;
}

.history-coverage-details-table__row[data-highlighted='true'] {
  @apply bg-emerald-50;
}

.history-coverage-details-table__monospace-cell {
  @apply px-3 py-2 font-mono text-zinc-700;
}

.history-coverage-details-table__muted-cell {
  @apply px-3 py-2 text-zinc-500;
}
</style>
