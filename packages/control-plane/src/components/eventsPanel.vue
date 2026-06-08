<script setup lang="ts">
import { computed } from 'vue';
import SolarEraserBold from '~icons/solar/eraser-bold';
import SolarPauseBold from '~icons/solar/pause-bold';
import SolarPlayBold from '~icons/solar/play-bold';
import SolarSettingsBold from '~icons/solar/settings-bold';

import type { AppEventItem, EventsPanelMode } from '../stores/controlPlaneTypes.js';
import { UiButton } from '@agentg/framework/cp';
import EventSettings from './eventSettings.vue';
import EventsList from './eventsList.vue';

const props = defineProps<{
  clearButtonId?: string;
  eventListId: string;
  eventLimit: number;
  eventSettingsId: string;
  eventYamlListLimit: number;
  events: AppEventItem[];
  hasEvents: boolean;
  mode: EventsPanelMode;
  panelId: string;
  settingsToggleId?: string;
  streamPaused: boolean;
  streamToggleId?: string;
}>();

const emit = defineEmits<{
  clear: [];
  closeSettings: [];
  eventLimitChange: [value: number];
  eventYamlListLimitChange: [value: number];
  settingsToggle: [];
  streamToggle: [];
}>();

const eventsVisible = computed(() => props.mode === 'events');
const settingsVisible = computed(() => props.mode === 'settings');
const sidePaneVisible = computed(() => settingsVisible.value);
const eventSettingsToggleVariant = computed(() => (settingsVisible.value ? 'selected' : 'neutral'));
const eventStreamToggleLabel = computed(() =>
  props.streamPaused ? 'Resume event stream' : 'Pause event stream'
);
const eventStreamStateLabel = computed(() => (props.streamPaused ? 'Paused' : 'Live'));
</script>

<template>
  <section :id="panelId" class="events-panel">
    <div class="events-panel__header">
      <div class="events-panel__title-frame">
        <div class="events-panel__title">Events</div>
      </div>
      <div class="events-panel__toolbar">
        <UiButton
          :id="streamToggleId"
          :aria-label="eventStreamToggleLabel"
          :aria-pressed="!streamPaused"
          class="events-panel__stream-button"
          :title="eventStreamToggleLabel"
          @click="emit('streamToggle')"
        >
          <span
            class="events-panel__stream-dot"
            :data-paused="streamPaused ? 'true' : undefined"
            aria-hidden="true"
          ></span>
          <span class="events-panel__stream-label">{{ eventStreamStateLabel }}</span>
          <span class="events-panel__stream-divider" aria-hidden="true"></span>
          <SolarPlayBold
            v-if="streamPaused"
            class="events-panel__button-icon-large"
            aria-hidden="true"
          />
          <SolarPauseBold v-else class="events-panel__button-icon-large" aria-hidden="true" />
        </UiButton>
        <UiButton
          :id="clearButtonId"
          aria-label="Clear events"
          size="icon-md"
          title="Clear events"
          @click="emit('clear')"
        >
          <SolarEraserBold class="events-panel__icon-button-icon" aria-hidden="true" />
        </UiButton>
        <UiButton
          :id="settingsToggleId"
          aria-label="Event settings"
          size="icon-md"
          title="Event settings"
          :variant="eventSettingsToggleVariant"
          @click="emit('settingsToggle')"
        >
          <SolarSettingsBold class="events-panel__icon-button-icon" aria-hidden="true" />
        </UiButton>
      </div>
    </div>
    <div class="events-panel__body" :data-side-pane="sidePaneVisible ? 'true' : undefined">
      <div v-show="eventsVisible || sidePaneVisible" class="events-panel__list-pane">
        <EventsList :id="eventListId" :events="events" :has-events="hasEvents" />
      </div>
      <div v-if="sidePaneVisible" class="events-panel__side-pane">
        <EventSettings
          v-show="settingsVisible"
          :id="eventSettingsId"
          :event-limit="eventLimit"
          :event-yaml-list-limit="eventYamlListLimit"
          @close="emit('closeSettings')"
          @event-limit-change="(value) => emit('eventLimitChange', value)"
          @event-yaml-list-limit-change="(value) => emit('eventYamlListLimitChange', value)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
@reference "tailwindcss";
.events-panel {
  @apply flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white;
}

.events-panel__header {
  @apply flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-3;
}

.events-panel__title {
  @apply text-base font-semibold;
}

.events-panel__toolbar {
  @apply flex shrink-0 flex-wrap items-center justify-end gap-2;
}

.events-panel__stream-button {
  @apply w-[128px] justify-start pl-[14px] pr-[10px];
}

.events-panel__stream-dot {
  @apply mr-[9px] h-[9px] w-[9px] rounded-full bg-[#16A34A];
}

.events-panel__stream-dot[data-paused='true'] {
  @apply bg-[#9CA3AF];
}

.events-panel__stream-label {
  @apply mr-[5px] w-[50px] min-w-0 text-left;
}

.events-panel__stream-divider {
  @apply mr-[9px] h-[18px] w-px bg-[#E5E7EB];
}

.events-panel__button-icon-large {
  @apply h-[18px] w-[18px] shrink-0 text-[#111827];
}

.events-panel__icon-button-icon {
  @apply h-4 w-4;
}

.events-panel__body {
  @apply grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden;
}

.events-panel__body[data-side-pane='true'] {
  @apply grid-rows-[minmax(0,1fr)_minmax(280px,42vh)] xl:grid-cols-[minmax(0,1fr)_minmax(340px,480px)] xl:grid-rows-none;
}

.events-panel__list-pane {
  @apply flex min-h-0 min-w-0 flex-col overflow-hidden;
}

.events-panel__side-pane {
  @apply flex min-h-0 min-w-0 flex-col overflow-hidden border-t border-zinc-200 xl:border-l xl:border-t-0;
}
</style>
