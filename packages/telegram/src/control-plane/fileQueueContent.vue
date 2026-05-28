<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useControlPlaneHost, type ControlPlaneHostEvent } from '@agentg/control-plane-sdk/host';
import UiMetricTile from '@agentg/control-plane-sdk/ui/metric-tile';

type FileQueueStats = {
  downloadingCount: number;
  knownRemainingBytes: number;
  queuedCount: number;
  remainingCount: number;
  unknownRemainingCount: number;
};

type FileQueueStatsResult = {
  stats?: unknown;
};

const host = useControlPlaneHost();
const stats = ref<FileQueueStats | null>(null);
let stopEvents: (() => void) | null = null;

const value = computed(() => formatInteger(stats.value?.remainingCount ?? 0));
const detail = computed(() => {
  const current = stats.value;
  if (current === null) {
    return 'waiting';
  }

  const parts = [
    `queued ${formatInteger(current.queuedCount)}`,
    `downloading ${formatInteger(current.downloadingCount)}`,
    `known ${formatBytes(current.knownRemainingBytes)}`
  ];
  if (current.unknownRemainingCount > 0) {
    parts.push(`unknown ${formatInteger(current.unknownRemainingCount)}`);
  }
  return parts.join(' | ');
});

onMounted(() => {
  stopEvents = host.subscribeEvents(receiveEvent);
  void loadInitialStats().catch(logInitialStatsError);
});

onBeforeUnmount(() => {
  stopEvents?.();
  stopEvents = null;
});

function receiveEvent(event: ControlPlaneHostEvent): void {
  if (event.type !== 'telegram.files.queue.updated') {
    return;
  }
  applyStats(event.data);
}

async function loadInitialStats(): Promise<void> {
  const result = await host.rpc<FileQueueStatsResult>('telegram.cp.fileQueueStats', {});
  applyStats(result.stats);
}

function applyStats(value: unknown): void {
  const data = asRecord(value);
  if (data === undefined) {
    return;
  }

  stats.value = {
    downloadingCount: nonNegativeNumber(data.downloadingCount),
    knownRemainingBytes: nonNegativeNumber(data.knownRemainingBytes),
    queuedCount: nonNegativeNumber(data.queuedCount),
    remainingCount: nonNegativeNumber(data.remainingCount),
    unknownRemainingCount: nonNegativeNumber(data.unknownRemainingCount)
  };
}

function formatBytes(value: number): string {
  if (value <= 0) {
    return '0 B';
  }
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value >= 10 * 1024 * 1024 ? 0 : 1,
    style: 'unit',
    unit: value >= 1024 * 1024 ? 'megabyte' : 'kilobyte',
    unitDisplay: 'short'
  }).format(value >= 1024 * 1024 ? value / (1024 * 1024) : value / 1024);
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}

function nonNegativeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function logInitialStatsError(error: unknown): void {
  console.warn(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      event: 'telegram.file_queue_stats_load_failed'
    })
  );
}
</script>

<template>
  <UiMetricTile label="File queue" :value="value" :detail="detail" />
</template>
