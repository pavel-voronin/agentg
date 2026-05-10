<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useControlPlaneHost } from '@agentg/control-plane-sdk/host';
import UiMetricTile from '@agentg/control-plane-sdk/ui/metric-tile';

type CoverageUpdate = {
  chatId: string;
  endAt: string;
  startAt: string;
};

const host = useControlPlaneHost();
const updateCount = ref(0);
const latestUpdate = ref<CoverageUpdate | null>(null);
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

    const intervals = coverageUpdatesFromEvent(event);
    if (intervals.length === 0) {
      return;
    }

    updateCount.value += intervals.length;
    latestUpdate.value = intervals.at(-1) ?? null;
  });
});

onBeforeUnmount(() => {
  stopEvents?.();
  stopEvents = null;
});

function coverageUpdatesFromEvent(event: { data?: unknown }): CoverageUpdate[] {
  return asRecords(asRecord(event.data)?.intervals).flatMap((interval) => {
    const chatId = asString(asRecord(interval.chat)?.id) ?? asString(interval.chatId);
    const startAt = asString(interval.startAt);
    const endAt = asString(interval.endAt);
    if (chatId === undefined || startAt === undefined || endAt === undefined) {
      return [];
    }

    return [{ chatId, endAt, startAt }];
  });
}

function updateDetail(update: CoverageUpdate): string {
  return `${update.chatId} - ${shortDate(update.startAt)} -> ${shortDate(update.endAt)}`;
}

function shortDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(5, 16).replace('T', ' ');
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => asRecord(item) !== undefined)
    : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
</script>

<template>
  <UiMetricTile :detail="tile.detail" :label="tile.label" :value="tile.value" />
</template>
