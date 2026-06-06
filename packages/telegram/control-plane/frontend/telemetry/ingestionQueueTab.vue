<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useControlPlaneHost, type ControlPlaneHostEvent } from '@agentg/framework/cp';

import {
  ingestionQueueSignalView,
  parseIngestionQueueSignal,
  type IngestionQueueSignalView
} from './ingestionQueueView.js';

const INGESTION_QUEUE_EVENT_TYPE = 'telegram.ingestion-queue';

const host = useControlPlaneHost();
const queue = ref<IngestionQueueSignalView | null>(null);
const error = ref<string | null>(null);
let unsubscribeEvents: (() => void) | null = null;

onMounted(() => {
  unsubscribeEvents = host.subscribeEvents(receiveEvent);
});

onBeforeUnmount(() => {
  unsubscribeEvents?.();
  unsubscribeEvents = null;
});

function receiveEvent(event: ControlPlaneHostEvent): void {
  if (event.type !== INGESTION_QUEUE_EVENT_TYPE) {
    return;
  }
  acceptSignal(event);
}

function acceptSignal(event: ControlPlaneHostEvent): void {
  try {
    queue.value = ingestionQueueSignalView(
      parseIngestionQueueSignal(event.data),
      event.occurredAt ?? null
    );
    error.value = null;
  } catch (signalError) {
    error.value = signalError instanceof Error ? signalError.message : String(signalError);
  }
}
</script>

<template>
  <section class="ingestion-queue-tab">
    <div v-if="error" class="ingestion-queue-tab__error">{{ error }}</div>

    <div v-if="queue" class="ingestion-queue-tab__grid">
      <div class="ingestion-queue-tab__stat" :data-tone="queue.tone">
        <div class="ingestion-queue-tab__stat-label">Pending</div>
        <div class="ingestion-queue-tab__stat-value">{{ queue.pending }}</div>
      </div>
      <div class="ingestion-queue-tab__stat">
        <div class="ingestion-queue-tab__stat-label">Running</div>
        <div class="ingestion-queue-tab__stat-value">{{ queue.running }}</div>
      </div>
      <div class="ingestion-queue-tab__stat">
        <div class="ingestion-queue-tab__stat-label">Limit</div>
        <div class="ingestion-queue-tab__stat-value">{{ queue.limit }}</div>
      </div>
      <div class="ingestion-queue-tab__stat">
        <div class="ingestion-queue-tab__stat-label">Utilization</div>
        <div class="ingestion-queue-tab__stat-value">{{ queue.utilization }}</div>
      </div>
    </div>

    <div v-else class="ingestion-queue-tab__empty">No queue signal</div>
  </section>
</template>

<style scoped>
@reference "tailwindcss";
.ingestion-queue-tab {
  @apply min-w-0;
}

.ingestion-queue-tab__grid {
  @apply mt-4 grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3;
}

.ingestion-queue-tab__stat {
  @apply min-w-0 rounded border border-zinc-200 bg-white p-3;
}

.ingestion-queue-tab__stat[data-tone='bad'] {
  @apply border-red-200 bg-red-50;
}

.ingestion-queue-tab__stat[data-tone='warn'] {
  @apply border-amber-200 bg-amber-50;
}

.ingestion-queue-tab__stat-label {
  @apply text-xs font-medium text-zinc-500;
}

.ingestion-queue-tab__stat-value {
  @apply mt-1 truncate text-lg font-semibold tabular-nums text-zinc-950;
}

.ingestion-queue-tab__error {
  @apply mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700;
}

.ingestion-queue-tab__empty {
  @apply py-6 text-sm text-zinc-500;
}
</style>
