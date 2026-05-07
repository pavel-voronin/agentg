<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { useControlPlaneHost } from '@agentg/control-plane-sdk/host';
import UiMetricTile from '@agentg/control-plane-sdk/ui/metric-tile';

type DirectoryResult = {
  chats?: unknown;
};

const host = useControlPlaneHost();
const chatCount = ref(0);
let stopEvents: (() => void) | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
  stopEvents = host.subscribeEvents((event) => {
    const type = event.type ?? '';
    if (type.startsWith('telegram.chat')) {
      scheduleRefresh();
    }
  });
  void refresh().catch(pushLocalError);
});

onBeforeUnmount(() => {
  stopEvents?.();
  stopEvents = null;
  clearRefreshTimer();
});

async function refresh(): Promise<void> {
  const directory = await host.rpc<DirectoryResult>('telegram.listChatDirectory', {});
  chatCount.value = Array.isArray(directory.chats) ? directory.chats.length : 0;
}

function scheduleRefresh(): void {
  clearRefreshTimer();
  refreshTimer = setTimeout(() => {
    void refresh().catch(pushLocalError);
  }, 250);
}

function clearRefreshTimer(): void {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}

function pushLocalError(error: unknown): void {
  console.error(error);
}
</script>

<template>
  <UiMetricTile label="Chats" :value="formatInteger(chatCount)" />
</template>
