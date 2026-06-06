<script setup lang="ts">
import SolarAltArrowDownBold from '~icons/solar/alt-arrow-down-bold';

import type {
  MetricColumnSortKey,
  MetricColumnView,
  MetricSectionView,
  MetricTableId,
  SortAria
} from '../types.js';
import type { MetricSort, MetricSortDirection, MetricSortKey } from '../report/reportView.js';

const numberColumnLabels = {
  avg: 'Avg',
  count: 'Calls',
  errors: 'Err',
  last: 'Last',
  max: 'Max',
  p50: 'P50',
  p95: 'P95',
  p99: 'P99',
  total: 'Total'
} satisfies Record<MetricColumnSortKey, string>;

const numberColumns: readonly MetricColumnView[] = [
  { key: 'count', label: numberColumnLabels.count },
  { key: 'avg', label: numberColumnLabels.avg },
  { key: 'p50', label: numberColumnLabels.p50 },
  { key: 'p95', label: numberColumnLabels.p95 },
  { key: 'p99', label: numberColumnLabels.p99 },
  { key: 'max', label: numberColumnLabels.max },
  { key: 'total', label: numberColumnLabels.total },
  { key: 'errors', label: numberColumnLabels.errors },
  { key: 'last', label: numberColumnLabels.last }
];

const props = defineProps<{
  section: MetricSectionView;
  sort: MetricSort;
}>();

const emit = defineEmits<{
  changeSort: [tableId: MetricTableId, key: MetricSortKey];
}>();

function sortAria(key: MetricSortKey): SortAria {
  if (props.sort.key !== key) {
    return 'none';
  }
  return props.sort.direction === 'asc' ? 'ascending' : 'descending';
}

function sortActive(key: MetricSortKey): boolean {
  return props.sort.key === key;
}

function sortIconDirection(key: MetricSortKey): MetricSortDirection {
  return sortActive(key) ? props.sort.direction : 'desc';
}

function sortButtonLabel(key: MetricSortKey): string {
  const direction = nextSortDirection(props.sort, key);
  return `Sort ${props.section.title} by ${columnLabel(key)} ${
    direction === 'asc' ? 'ascending' : 'descending'
  }`;
}

function sortMeta(): string {
  return `sorted by ${columnLabel(props.sort.key)} ${props.sort.direction}`;
}

function columnLabel(key: MetricSortKey): string {
  return key === 'name' ? props.section.firstColumnLabel : numberColumnLabels[key];
}

function nextSortDirection(current: MetricSort, key: MetricSortKey): MetricSortDirection {
  return current.key === key && current.direction === 'desc' ? 'asc' : 'desc';
}
</script>

<template>
  <section class="metric-table">
    <div class="metric-table__section-header">
      <h3 class="metric-table__section-title">{{ section.title }}</h3>
      <div class="metric-table__section-meta">{{ sortMeta() }}</div>
    </div>
    <div class="metric-table__frame">
      <table v-if="section.rows.length > 0" class="metric-table__table">
        <thead class="metric-table__head">
          <tr class="metric-table__row">
            <th class="metric-table__name-cell" :aria-sort="sortAria('name')">
              <button
                type="button"
                class="metric-table__sort-button"
                data-align="left"
                :aria-label="sortButtonLabel('name')"
                :data-active="sortActive('name') ? 'true' : undefined"
                :title="sortButtonLabel('name')"
                @click="emit('changeSort', section.id, 'name')"
              >
                <span class="metric-table__sort-label">
                  {{ section.firstColumnLabel }}
                </span>
                <SolarAltArrowDownBold
                  class="metric-table__sort-icon"
                  :data-active="sortActive('name') ? 'true' : undefined"
                  :data-direction="sortIconDirection('name')"
                  aria-hidden="true"
                />
              </button>
            </th>
            <th
              v-for="column in numberColumns"
              :key="column.key"
              class="metric-table__number-cell"
              :aria-sort="sortAria(column.key)"
            >
              <button
                type="button"
                class="metric-table__sort-button"
                data-align="right"
                :aria-label="sortButtonLabel(column.key)"
                :data-active="sortActive(column.key) ? 'true' : undefined"
                :title="sortButtonLabel(column.key)"
                @click="emit('changeSort', section.id, column.key)"
              >
                <span class="metric-table__sort-label">{{ column.label }}</span>
                <SolarAltArrowDownBold
                  class="metric-table__sort-icon"
                  :data-active="sortActive(column.key) ? 'true' : undefined"
                  :data-direction="sortIconDirection(column.key)"
                  aria-hidden="true"
                />
              </button>
            </th>
          </tr>
        </thead>
        <tbody class="metric-table__body">
          <tr v-for="row in section.rows" :key="row.key" class="metric-table__row">
            <td class="metric-table__name-cell">
              <div class="metric-table__row-name">{{ row.name }}</div>
              <div class="metric-table__row-source">{{ row.source }}</div>
            </td>
            <td class="metric-table__number-cell">{{ row.count }}</td>
            <td class="metric-table__number-cell">{{ row.avg }}</td>
            <td class="metric-table__number-cell">{{ row.p50 }}</td>
            <td class="metric-table__number-cell">{{ row.p95 }}</td>
            <td class="metric-table__number-cell">{{ row.p99 }}</td>
            <td class="metric-table__number-cell">{{ row.max }}</td>
            <td class="metric-table__number-cell">{{ row.total }}</td>
            <td class="metric-table__number-cell">{{ row.errors }}</td>
            <td class="metric-table__number-cell">{{ row.last }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="metric-table__empty">{{ section.emptyLabel }}</div>
    </div>
  </section>
</template>

<style scoped>
@reference "tailwindcss";

.metric-table {
  @apply mt-6 border-t border-zinc-200 pt-4;
}

.metric-table__section-header {
  @apply mb-3 flex items-baseline justify-between gap-3;
}

.metric-table__section-title {
  @apply text-base font-semibold tracking-normal;
}

.metric-table__section-meta {
  @apply shrink-0 text-xs text-zinc-500;
}

.metric-table__frame {
  @apply overflow-auto;
}

.metric-table__table {
  @apply w-full min-w-[1080px] border-collapse text-sm;
}

.metric-table__head {
  @apply border-b border-zinc-200 text-xs text-zinc-500;
}

.metric-table__body {
  @apply divide-y divide-zinc-100;
}

.metric-table__row {
  @apply align-top;
}

.metric-table__sort-button {
  @apply inline-flex w-full items-center gap-1 rounded px-1 py-0.5 font-semibold text-zinc-500 transition-colors hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300;
}

.metric-table__sort-button[data-active='true'] {
  @apply text-zinc-950;
}

.metric-table__sort-button[data-align='left'] {
  @apply justify-start;
}

.metric-table__sort-button[data-align='right'] {
  @apply justify-end;
}

.metric-table__sort-label {
  @apply truncate;
}

.metric-table__sort-icon {
  @apply size-3 shrink-0 opacity-20 transition-transform;
}

.metric-table__sort-icon[data-active='true'] {
  @apply opacity-100;
}

.metric-table__sort-icon[data-direction='asc'] {
  @apply rotate-180;
}

.metric-table__name-cell {
  @apply max-w-[360px] py-2 pr-4 text-left;
}

.metric-table__number-cell {
  @apply whitespace-nowrap py-2 pl-3 text-right tabular-nums;
}

.metric-table__row-name {
  @apply truncate font-medium text-zinc-900;
}

.metric-table__row-source {
  @apply mt-0.5 truncate text-xs text-zinc-500;
}

.metric-table__empty {
  @apply py-6 text-sm text-zinc-500;
}
</style>
