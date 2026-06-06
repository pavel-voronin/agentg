<script setup lang="ts">
import MetricTable from './metricTable.vue';
import SamplesList from '../samples/samplesList.vue';
import TabNav from '../navigation/tabNav.vue';
import type { MetricPanelId, MetricSectionView, NestedTabView } from '../types.js';
import type { MetricSort, MetricSortKey, PageView } from '../report/reportView.js';

const metricPanelTabs = [
  { id: 'metrics', label: 'Metrics' },
  { id: 'samples', label: 'Samples' }
] satisfies readonly NestedTabView<MetricPanelId>[];

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

function selectPanel(panelId: string): void {
  if (panelId === 'metrics' || panelId === 'samples') {
    emit('selectPanel', panelId);
  }
}
</script>

<template>
  <div class="metric-tab-panel">
    <TabNav
      :active-id="activePanel"
      navigation-label="Telemetry metric views"
      :tabs="metricPanelTabs"
      variant="nested"
      @select="selectPanel"
    />

    <MetricTable
      v-if="activePanel === 'metrics'"
      :section="section"
      :sort="sort"
      @change-sort="changeSort"
    />

    <SamplesList
      v-if="activePanel === 'samples'"
      :dropped-records="droppedRecords"
      :ignored-records="ignoredRecords"
      :rows="sampleRows"
      :title="sampleTitle"
    />
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.metric-tab-panel {
  @apply min-w-0;
}
</style>
