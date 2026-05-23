<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

import type { AppEventItem, AppRpcEventItem } from '../stores/controlPlaneTypes.js';
import RpcEventListItem from './rpcEventListItem.vue';
import StandardEventListItem from './standardEventListItem.vue';

const props = defineProps<{
  events: AppEventItem[];
  hasEvents: boolean;
}>();

const emit = defineEmits<{
  clearType: [type: string];
  muteChange: [type: string, muted: boolean];
}>();

type ScrollContainer = {
  scrollHeight: number;
  scrollTop: number;
};

type ScrollState = {
  scrollHeight: number;
  scrollTop: number;
  stickyTop: boolean;
};

const container = ref<ScrollContainer | null>(null);
const rpcMuteSnapshots = ref<Record<string, Record<string, boolean>>>({});

watch(
  () => props.events,
  () => {
    pruneRpcMuteSnapshots();
    const scrollState = captureScrollState();
    void nextTick(() => {
      restoreScrollState(scrollState);
    });
  },
  { flush: 'pre' }
);

function captureScrollState(): ScrollState | null {
  const current = container.value;
  if (!current) {
    return null;
  }
  return {
    scrollHeight: current.scrollHeight,
    scrollTop: current.scrollTop,
    stickyTop: current.scrollTop <= 4
  };
}

function restoreScrollState(state: ScrollState | null): void {
  const current = container.value;
  if (!state || !current) {
    return;
  }
  if (state.stickyTop) {
    current.scrollTop = 0;
    return;
  }
  current.scrollTop = state.scrollTop + current.scrollHeight - state.scrollHeight;
}

function toggleRpcMute(item: AppRpcEventItem): void {
  if (item.muted) {
    restoreRpcMute(item);
    return;
  }
  rpcMuteSnapshots.value = {
    ...rpcMuteSnapshots.value,
    [item.target]: Object.fromEntries(
      item.lifecycleTypes.map((type) => [
        type,
        item.lifecycles.find((lifecycle) => lifecycle.type === type)?.muted ?? false
      ])
    )
  };
  for (const type of item.lifecycleTypes) {
    emit('muteChange', type, true);
  }
}

function restoreRpcMute(item: AppRpcEventItem): void {
  const snapshot = rpcMuteSnapshots.value[item.target];
  for (const type of item.lifecycleTypes) {
    emit('muteChange', type, snapshot?.[type] ?? false);
  }
  rpcMuteSnapshots.value = Object.fromEntries(
    Object.entries(rpcMuteSnapshots.value).filter(([target]) => target !== item.target)
  );
}

function pruneRpcMuteSnapshots(): void {
  const activeRpcTargets = new Set(
    props.events.flatMap((event) => (event.kind === 'rpc' ? [event.target] : []))
  );
  rpcMuteSnapshots.value = Object.fromEntries(
    Object.entries(rpcMuteSnapshots.value).filter(([target]) => activeRpcTargets.has(target))
  );
}
</script>

<template>
  <div ref="container" class="events-list">
    <div v-if="!hasEvents" class="events-list__empty">No events yet.</div>
    <template v-for="event in events" :key="event.key">
      <StandardEventListItem
        v-if="event.kind === 'event'"
        :event="event"
        @clear-type="(type) => emit('clearType', type)"
        @mute-change="(type, muted) => emit('muteChange', type, muted)"
      />
      <RpcEventListItem
        v-else
        :event="event"
        @clear-type="(type) => emit('clearType', type)"
        @mute-change="(type, muted) => emit('muteChange', type, muted)"
        @procedure-mute-toggle="toggleRpcMute"
      />
    </template>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.events-list {
  @apply min-h-0 flex-1 overflow-auto bg-white;
}

.events-list__empty {
  @apply p-6 text-center text-sm text-zinc-500;
}
</style>
