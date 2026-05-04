<script setup lang="ts">
import { computed, ref } from 'vue';

import type { AppStandardEventItem } from '../stores/controlPlaneTypes.js';
import EventBodyBlock from './EventBodyBlock.vue';

defineProps<{
  event: AppStandardEventItem;
}>();

const emit = defineEmits<{
  clearType: [type: string];
  muteChange: [type: string, muted: boolean];
}>();

type EventBodyMode = 'raw' | 'yaml';

const bodyMode = ref<EventBodyMode>('yaml');
const bodyModeLabel = computed(() => (bodyMode.value === 'yaml' ? 'YAML' : 'RAW'));

function toggleBodyMode(): void {
  bodyMode.value = bodyMode.value === 'yaml' ? 'raw' : 'yaml';
}
</script>

<template>
  <div
    :class="[
      'relative border-b border-zinc-200 py-2 pl-4 pr-3 font-mono text-xs leading-relaxed transition-colors',
      event.muted ? 'bg-zinc-100 text-zinc-500' : 'bg-white'
    ]"
  >
    <div
      class="absolute left-0 top-0 h-full w-1.5"
      :class="{ 'opacity-35': event.muted }"
      :style="{ background: event.color }"
    ></div>
    <div class="mb-1 flex items-center gap-2">
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <span :class="['shrink-0', event.muted ? 'text-zinc-400' : 'text-zinc-500']">
          {{ event.occurredAt }}
        </span>
        <span
          :class="[
            'min-w-0 truncate font-semibold',
            event.muted ? 'text-zinc-500' : 'text-zinc-900'
          ]"
        >
          {{ event.type }}
        </span>
        <button
          v-if="event.filterable"
          type="button"
          :aria-pressed="event.muted"
          :aria-label="event.muted ? `Unmute ${event.type}` : `Mute ${event.type}`"
          :title="event.muted ? `Unmute ${event.type}` : `Mute ${event.type}`"
          :class="[
            'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px]',
            event.muted
              ? 'border-zinc-400 bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
              : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
          ]"
          @click="emit('muteChange', event.type, !event.muted)"
        >
          <svg
            class="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4 8.5v3h3L11 15V5L7 8.5H4Z" />
            <path v-if="event.muted" d="m14 8 3 3m0-3-3 3" />
            <path v-else d="M14 7.5a4 4 0 0 1 0 5" />
          </svg>
        </button>
        <button
          v-if="event.muted"
          type="button"
          :aria-label="`Clear ${event.type}`"
          :title="`Clear ${event.type}`"
          class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
          @click="emit('clearType', event.type)"
        >
          <svg
            class="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="m6 6 8 8M14 6l-8 8" />
          </svg>
        </button>
      </div>
      <button
        type="button"
        class="inline-flex h-5 shrink-0 items-center rounded border border-zinc-200 bg-white px-1.5 font-mono text-[10px] font-semibold text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
        :aria-label="`Switch ${event.type} body display mode`"
        :title="`Body mode: ${bodyModeLabel}`"
        @click="toggleBodyMode"
      >
        {{ bodyModeLabel }}
      </button>
    </div>
    <EventBodyBlock :body="event.body" :mode="bodyMode" :muted="event.muted" />
  </div>
</template>
