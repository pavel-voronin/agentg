<script setup lang="ts">
import { computed, ref } from 'vue';
import SolarCloseCircleBold from '~icons/solar/close-circle-bold';
import SolarVolumeCrossBold from '~icons/solar/volume-cross-bold';
import SolarVolumeLoudBold from '~icons/solar/volume-loud-bold';

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
  <div class="standard-event-item" :data-muted="event.muted ? 'true' : undefined">
    <div
      class="standard-event-item__stripe"
      :data-muted="event.muted ? 'true' : undefined"
      :style="{ background: event.color }"
    ></div>
    <div class="standard-event-item__header">
      <div class="standard-event-item__meta">
        <span class="standard-event-item__time" :data-muted="event.muted ? 'true' : undefined">
          {{ event.occurredAt }}
        </span>
        <span class="standard-event-item__type" :data-muted="event.muted ? 'true' : undefined">
          {{ event.type }}
        </span>
        <button
          v-if="event.filterable"
          type="button"
          :aria-pressed="event.muted"
          :aria-label="event.muted ? `Unmute ${event.type}` : `Mute ${event.type}`"
          :title="event.muted ? `Unmute ${event.type}` : `Mute ${event.type}`"
          class="standard-event-item__mute-button"
          :data-muted="event.muted ? 'true' : undefined"
          @click="emit('muteChange', event.type, !event.muted)"
        >
          <SolarVolumeCrossBold
            v-if="event.muted"
            class="standard-event-item__button-icon"
            aria-hidden="true"
          />
          <SolarVolumeLoudBold v-else class="standard-event-item__button-icon" aria-hidden="true" />
        </button>
        <button
          v-if="event.muted"
          type="button"
          :aria-label="`Clear ${event.type}`"
          :title="`Clear ${event.type}`"
          class="standard-event-item__clear-button"
          @click="emit('clearType', event.type)"
        >
          <SolarCloseCircleBold class="standard-event-item__button-icon" aria-hidden="true" />
        </button>
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
    <EventBodyBlock :body="event.body" :mode="bodyMode" :muted="event.muted" />
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.standard-event-item {
  @apply relative border-b border-zinc-200 bg-white py-2 pl-4 pr-3 font-mono text-xs leading-relaxed transition-colors;
}

.standard-event-item[data-muted='true'] {
  @apply bg-zinc-100 text-zinc-500;
}

.standard-event-item__stripe {
  @apply absolute left-0 top-0 h-full w-1.5;
}

.standard-event-item__stripe[data-muted='true'] {
  @apply opacity-35;
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

.standard-event-item__time[data-muted='true'] {
  @apply text-zinc-400;
}

.standard-event-item__type {
  @apply min-w-0 truncate font-semibold text-zinc-900;
}

.standard-event-item__type[data-muted='true'] {
  @apply text-zinc-500;
}

.standard-event-item__mute-button {
  @apply inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-200 bg-white text-[10px] text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900;
}

.standard-event-item__mute-button[data-muted='true'] {
  @apply border-zinc-400 bg-zinc-200 text-zinc-600 hover:bg-zinc-300;
}

.standard-event-item__clear-button {
  @apply inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900;
}

.standard-event-item__button-icon {
  @apply h-3.5 w-3.5;
}

.standard-event-item__body-mode-button {
  @apply inline-flex h-5 shrink-0 items-center rounded border border-zinc-200 bg-white px-1.5 font-mono text-[10px] font-semibold text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900;
}
</style>
