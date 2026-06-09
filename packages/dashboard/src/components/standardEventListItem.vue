<script setup lang="ts">
import { computed, ref } from 'vue';

import type { AppStandardEventItem } from '../stores/dashboardTypes.js';
import EventBodyBlock from './eventBodyBlock.vue';

defineProps<{
  event: AppStandardEventItem;
}>();

type EventBodyMode = 'raw' | 'yaml';

const bodyMode = ref<EventBodyMode>('yaml');
const bodyModeLabel = computed(() => (bodyMode.value === 'yaml' ? 'YAML' : 'RAW'));

function toggleBodyMode(): void {
  bodyMode.value = bodyMode.value === 'yaml' ? 'raw' : 'yaml';
}
</script>

<template>
  <div class="standard-event-item">
    <div class="standard-event-item__stripe" :style="{ background: event.color }"></div>
    <div class="standard-event-item__header">
      <div class="standard-event-item__meta">
        <span class="standard-event-item__time">{{ event.occurredAt }}</span>
        <span class="standard-event-item__type">{{ event.type }}</span>
      </div>
      <button
        type="button"
        class="standard-event-item__body-mode-button"
        :aria-label="`Switch ${event.type} body display mode`"
        :title="`Body mode: ${bodyModeLabel}`"
        @click="toggleBodyMode"
      >
        {{ bodyModeLabel }}
      </button>
    </div>
    <EventBodyBlock :body="event.body" :mode="bodyMode" />
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.standard-event-item {
  @apply relative border-b border-zinc-200 bg-white py-2 pl-4 pr-3 font-mono text-xs leading-relaxed transition-colors;
}

.standard-event-item__stripe {
  @apply absolute left-0 top-0 h-full w-1.5;
}

.standard-event-item__header {
  @apply mb-1 flex items-center gap-2;
}

.standard-event-item__meta {
  @apply flex min-w-0 flex-1 items-center gap-2;
}

.standard-event-item__time {
  @apply shrink-0 text-zinc-500;
}

.standard-event-item__type {
  @apply min-w-0 truncate font-semibold text-zinc-900;
}

.standard-event-item__body-mode-button {
  @apply inline-flex h-5 shrink-0 items-center rounded border border-zinc-200 bg-white px-1.5 font-mono text-[10px] font-semibold text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900;
}
</style>
