<script setup lang="ts">
import type { AppEventItem } from '../stores/controlPlaneStore.js';

defineProps<{
  events: AppEventItem[];
  hasEvents: boolean;
}>();
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto bg-white">
    <div v-if="!hasEvents" class="p-6 text-center text-sm text-zinc-500">No events yet.</div>
    <div
      v-for="event in events"
      :key="event.key"
      class="relative border-b border-zinc-200 bg-white py-2 pl-4 pr-3 font-mono text-xs leading-relaxed"
    >
      <div class="absolute left-0 top-0 h-full w-1.5" :style="{ background: event.color }"></div>
      <div class="mb-1 flex flex-wrap items-center gap-2">
        <span class="text-zinc-500">{{ event.occurredAt }}</span>
        <span class="font-semibold text-zinc-900">{{ event.type }}</span>
      </div>
      <pre class="m-0 whitespace-pre-wrap break-words text-zinc-700">{{ event.dataJson }}</pre>
    </div>
  </div>
</template>
