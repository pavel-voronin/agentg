<script setup lang="ts">
import MetricTabPanel from '../metrics/metricTabPanel.vue';
import type { MetricPanelId, MetricSectionView } from '../types.js';
import type { MetricSort, MetricSortKey, PageView } from '../report/reportView.js';

defineProps<{
  activePanel: MetricPanelId;
  droppedRecords: string;
  ignoredRecords: string;
  sampleRows: PageView['slowestRows'];
  sampleTitle: string;
  section: MetricSectionView;
  sort: MetricSort;
}>();

const emit = defineEmits<{
  changeSort: [tableId: MetricSectionView['id'], key: MetricSortKey];
  selectPanel: [panelId: MetricPanelId];
}>();

function changeSort(tableId: MetricSectionView['id'], key: MetricSortKey): void {
  emit('changeSort', tableId, key);
}
</script>

<template>
  <MetricTabPanel
    :active-panel="activePanel"
    :dropped-records="droppedRecords"
    :ignored-records="ignoredRecords"
    :sample-rows="sampleRows"
    :sample-title="sampleTitle"
    :section="section"
    :sort="sort"
    @change-sort="changeSort"
    @select-panel="emit('selectPanel', $event)"
  />
</template>
