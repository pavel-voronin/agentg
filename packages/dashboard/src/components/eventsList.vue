<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

import type { AppEventItem } from '../stores/dashboardTypes.js';
import RpcEventListItem from './rpcEventListItem.vue';
import StandardEventListItem from './standardEventListItem.vue';

const props = defineProps<{
  events: AppEventItem[];
  hasEvents: boolean;
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

watch(
  () => props.events,
  () => {
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
</script>

<template>
  <div ref="container" class="events-list">
    <div v-if="!hasEvents" class="events-list__empty">No events yet.</div>
    <template v-for="event in events" :key="event.key">
      <StandardEventListItem v-if="event.kind === 'event'" :event="event" />
      <RpcEventListItem v-else :event="event" />
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
