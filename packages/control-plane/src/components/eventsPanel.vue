<script setup lang="ts">
import { computed } from 'vue';
import SolarEraserBold from '~icons/solar/eraser-bold';
import SolarFiltersBold from '~icons/solar/filters-bold';
import SolarPauseBold from '~icons/solar/pause-bold';
import SolarPlayBold from '~icons/solar/play-bold';
import SolarSettingsBold from '~icons/solar/settings-bold';

import type {
  AppEventItem,
  EventFiltersPanelView,
  EventsPanelMode
} from '../stores/controlPlaneTypes.js';
import { UiButton } from '@agentg/framework/cp';
import EventFilters from './eventFilters.vue';
import EventSettings from './eventSettings.vue';
import EventsList from './eventsList.vue';

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
          <SolarPlayBold
            v-if="streamPaused"
            class="events-panel__button-icon-large"
            aria-hidden="true"
          />
          <SolarPauseBold v-else class="events-panel__button-icon-large" aria-hidden="true" />
        </UiButton>
        <UiButton
          :id="filtersToggleId"
          class="events-panel__filters-button"
          :variant="eventFilterToggleVariant"
          @click="emit('filtersToggle')"
        >
          <SolarFiltersBold class="events-panel__button-icon" aria-hidden="true" />
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
