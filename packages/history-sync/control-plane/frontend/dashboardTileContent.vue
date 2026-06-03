<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useControlPlaneHost } from '@agentg/framework/cp';
import { UiMetricTile } from '@agentg/framework/cp';

import { coverageUpdateBatchFromEvent, type CoverageUpdateBatch } from './coverageUpdates.js';

const host = useControlPlaneHost();
const updateCount = ref(0);
const latestUpdate = ref<CoverageUpdateBatch | null>(null);
let stopEvents: (() => void) | null = null;

const tile = computed(() => ({
  detail: latestUpdate.value === null ? 'idle' : updateDetail(latestUpdate.value),
  label: 'Coverage updates',
  value: String(updateCount.value)
}));

onMounted(() => {
  stopEvents = host.subscribeEvents((event) => {
    if (event.type !== 'telegram.history.coverage.changed') {
      return;
    }

    const batch = coverageUpdateBatchFromEvent(event);
    if (batch === null) {
      return;
    }

    updateCount.value += 1;
    latestUpdate.value = batch;
  });
});

onBeforeUnmount(() => {
  stopEvents?.();
  stopEvents = null;
});

function updateDetail(update: CoverageUpdateBatch): string {
  return `${String(update.chatCount)} chats - ${shortDate(update.latestInterval.startAt)} -> ${shortDate(update.latestInterval.endAt)}`;
}

function shortDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(5, 16).replace('T', ' ');
}
</script>

<template>
  <UiMetricTile :detail="tile.detail" :label="tile.label" :value="tile.value" />
</template>
