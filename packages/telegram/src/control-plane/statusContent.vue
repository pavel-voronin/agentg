<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useControlPlaneHost, type ControlPlaneHostEvent } from '@agentg/control-plane-sdk/host';
import UiStatusBadge from '@agentg/control-plane-sdk/ui/status-badge';

const host = useControlPlaneHost();
const connected = ref(false);
const lastStatusAt = ref<Date | null>(null);
const startedAt = Date.now();
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;
let stopEvents: (() => void) | null = null;

const kind = computed(() => {
  if (lastStatusAt.value === null) {
    return now.value - startedAt > 15000 ? 'bad' : 'warn';
  }
  const age = now.value - lastStatusAt.value.getTime();
  return connected.value && age <= 15000 ? 'ok' : 'bad';
});

onMounted(() => {
  stopEvents = host.subscribeEvents(receiveEvent);
  timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onBeforeUnmount(() => {
  stopEvents?.();
  stopEvents = null;
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
});

function receiveEvent(event: ControlPlaneHostEvent): void {
  if (event.type !== 'telegram.status') {
    return;
  }
  const data = isPlainRecord(event.data) ? event.data : {};
  connected.value = data.connected === true;
  lastStatusAt.value = new Date(event.occurredAt ?? Date.now());
  now.value = Date.now();
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
</script>

<template>
  <UiStatusBadge label="TDLIB" :kind="kind" />
</template>
