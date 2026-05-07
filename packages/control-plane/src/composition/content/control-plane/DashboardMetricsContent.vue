<script setup lang="ts">
import { computed } from 'vue';

import type { SlotContext } from '@agentg/control-plane-extension/slots';
import DashboardMetrics from '../../../components/DashboardMetrics.vue';
import { useOverviewStore } from '../../../stores/overview.js';
import { dashboardMetricsFromOverview } from '../../../view-models/dashboardView.js';

defineProps<{
  slotContext?: SlotContext | undefined;
}>();

const overviewStore = useOverviewStore();
const dashboardMetrics = computed(() => dashboardMetricsFromOverview(overviewStore.overview));
</script>

<template>
  <DashboardMetrics :metrics="dashboardMetrics" />
</template>
