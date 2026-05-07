<script setup lang="ts">
import { computed } from 'vue';

import type {
  AppEventItem,
  EventFiltersPanelView,
  EventsPanelMode
} from '../stores/controlPlaneTypes.js';
import UiButton from '@agentg/control-plane-sdk/ui';
import EventFilters from './EventFilters.vue';
import EventSettings from './EventSettings.vue';
import EventsList from './EventsList.vue';

const props = defineProps<{
  clearButtonId?: string;
  eventFiltersId: string;
  eventListId: string;
  eventLimit: number;
  eventSettingsId: string;
  eventYamlListLimit: number;
  events: AppEventItem[];
  filtersToggleId?: string;
  hasEvents: boolean;
  mode: EventsPanelMode;
  panelId: string;
  settingsToggleId?: string;
  streamPaused: boolean;
  streamToggleId?: string;
  view: EventFiltersPanelView;
}>();

const emit = defineEmits<{
  clear: [];
  clearType: [type: string];
  closeFilters: [];
  closeSettings: [];
  eventLimitChange: [value: number];
  eventYamlListLimitChange: [value: number];
  filtersToggle: [];
  muteChange: [type: string, muted: boolean];
  settingsToggle: [];
  streamToggle: [];
  typeChange: [type: string, enabled: boolean];
}>();

const eventsVisible = computed(() => props.mode === 'events');
const filtersVisible = computed(() => props.mode === 'filters');
const settingsVisible = computed(() => props.mode === 'settings');
const eventFilterToggleVariant = computed(() => (filtersVisible.value ? 'selected' : 'neutral'));
const eventSettingsToggleVariant = computed(() => (settingsVisible.value ? 'selected' : 'neutral'));
const eventStreamToggleLabel = computed(() =>
  props.streamPaused ? 'Resume event stream' : 'Pause event stream'
);
const eventStreamStateLabel = computed(() => (props.streamPaused ? 'Paused' : 'Live'));
</script>

<template>
  <aside :id="panelId" class="events-panel">
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
          <svg
            v-if="streamPaused"
            class="events-panel__button-icon-large"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M6 4.75v10.5c0 .63.7 1.01 1.22.66l7.75-5.25a.79.79 0 0 0 0-1.32L7.22 4.09A.78.78 0 0 0 6 4.75Z"
            />
          </svg>
          <svg
            v-else
            class="events-panel__button-icon-large"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M6 4.5A1.5 1.5 0 0 1 7.5 3h.25a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H7.5A1.5 1.5 0 0 1 6 15.5v-11ZM10.75 4.5A1.5 1.5 0 0 1 12.25 3h.25A1.5 1.5 0 0 1 14 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-.25a1.5 1.5 0 0 1-1.5-1.5v-11Z"
            />
          </svg>
        </UiButton>
        <UiButton
          :id="filtersToggleId"
          class="events-panel__filters-button"
          :variant="eventFilterToggleVariant"
          @click="emit('filtersToggle')"
        >
          <svg
            class="events-panel__button-icon"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 5h14" />
            <path d="M6 10h8" />
            <path d="M8 15h4" />
          </svg>
          <span>Filters</span>
          <span class="events-panel__filters-count">
            {{ view.enabledCount }}
          </span>
        </UiButton>
        <UiButton
          :id="clearButtonId"
          aria-label="Clear events"
          size="icon-md"
          title="Clear events"
          @click="emit('clear')"
        >
          <svg
            class="events-panel__icon-button-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m15 4 5 5" />
            <path d="m14 5 5 5" />
            <path d="m7 12 5 5" />
            <path d="m5 14 5 5" />
            <path d="M4 20h11" />
            <path d="m11 8-5 5 5 5 5-5" />
          </svg>
        </UiButton>
        <UiButton
          :id="settingsToggleId"
          aria-label="Event settings"
          size="icon-md"
          title="Event settings"
          :variant="eventSettingsToggleVariant"
          @click="emit('settingsToggle')"
        >
          <svg
            class="events-panel__icon-button-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              d="M9.67 4.14a2.34 2.34 0 0 1 4.66 0 2.34 2.34 0 0 0 3.32 1.91 2.34 2.34 0 0 1 2.33 4.03 2.34 2.34 0 0 0 0 3.84 2.34 2.34 0 0 1-2.33 4.03 2.34 2.34 0 0 0-3.32 1.91 2.34 2.34 0 0 1-4.66 0 2.34 2.34 0 0 0-3.32-1.91 2.34 2.34 0 0 1-2.33-4.03 2.34 2.34 0 0 0 0-3.84 2.34 2.34 0 0 1 2.33-4.03 2.34 2.34 0 0 0 3.32-1.91"
            />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </UiButton>
      </div>
    </div>
    <EventsList
      v-show="eventsVisible"
      :id="eventListId"
      :events="events"
      :has-events="hasEvents"
      @clear-type="(type) => emit('clearType', type)"
      @mute-change="(type, muted) => emit('muteChange', type, muted)"
    />
    <EventFilters
      v-show="filtersVisible"
      :id="eventFiltersId"
      :view="view"
      @close="emit('closeFilters')"
      @type-change="(type, enabled) => emit('typeChange', type, enabled)"
    />
    <EventSettings
      v-show="settingsVisible"
      :id="eventSettingsId"
      :event-limit="eventLimit"
      :event-yaml-list-limit="eventYamlListLimit"
      @close="emit('closeSettings')"
      @event-limit-change="(value) => emit('eventLimitChange', value)"
      @event-yaml-list-limit-change="(value) => emit('eventYamlListLimitChange', value)"
    />
  </aside>
</template>

<style scoped>
@reference "tailwindcss";
.events-panel {
  @apply flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white;
}

.events-panel__header {
  @apply flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 p-3;
}

.events-panel__title {
  @apply text-sm font-semibold;
}

.events-panel__toolbar {
  @apply flex shrink-0 items-center gap-2;
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

.events-panel__filters-button {
  @apply gap-1.5 px-2.5;
}

.events-panel__button-icon {
  @apply h-3.5 w-3.5;
}

.events-panel__filters-count {
  @apply rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] leading-none text-zinc-500;
}

.events-panel__icon-button-icon {
  @apply h-4 w-4;
}
</style>
