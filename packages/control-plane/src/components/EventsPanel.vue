<script setup lang="ts">
import { computed } from 'vue';

import type { AppEventItem, EventFiltersPanelView } from '../stores/controlPlaneTypes.js';
import EventFilters from './EventFilters.vue';
import EventsList from './EventsList.vue';

const props = defineProps<{
  clearButtonId?: string;
  eventFiltersId: string;
  eventListId: string;
  events: AppEventItem[];
  filtersToggleId?: string;
  filtersVisible: boolean;
  hasEvents: boolean;
  panelId: string;
  streamPaused: boolean;
  streamToggleId?: string;
  view: EventFiltersPanelView;
}>();

const emit = defineEmits<{
  clear: [];
  clearType: [type: string];
  closeFilters: [];
  filtersToggle: [];
  muteChange: [type: string, muted: boolean];
  streamToggle: [];
  typeChange: [type: string, enabled: boolean];
}>();

const eventFilterToggleClass = computed(() =>
  props.filtersVisible
    ? 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-800 px-2.5 text-sm font-medium text-white hover:bg-zinc-950'
    : 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50'
);
const eventStreamToggleClass = computed(() =>
  props.streamPaused
    ? 'inline-flex h-8 w-[5.75rem] items-center justify-center gap-1.5 rounded-lg border border-amber-400 bg-white px-2 text-sm font-medium text-amber-700 hover:bg-amber-50'
    : 'inline-flex h-8 w-[5.75rem] items-center justify-center gap-1.5 rounded-lg border border-emerald-500 bg-white px-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50'
);
const eventStreamToggleLabel = computed(() =>
  props.streamPaused ? 'Resume event stream' : 'Pause event stream'
);
const eventStreamStateLabel = computed(() => (props.streamPaused ? 'Paused' : 'Live'));
const eventStreamDotClass = computed(() =>
  props.streamPaused ? 'bg-amber-500' : 'bg-emerald-500'
);
</script>

<template>
  <aside
    :id="panelId"
    class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white"
  >
    <div class="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 p-3">
      <div>
        <div class="text-sm font-semibold">Events</div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button
          :id="streamToggleId"
          type="button"
          :aria-label="eventStreamToggleLabel"
          :aria-pressed="!streamPaused"
          :class="eventStreamToggleClass"
          :title="eventStreamToggleLabel"
          @click="emit('streamToggle')"
        >
          <span :class="['h-2 w-2 rounded-full', eventStreamDotClass]" aria-hidden="true"></span>
          <span class="min-w-0">{{ eventStreamStateLabel }}</span>
          <svg
            v-if="streamPaused"
            class="h-3.5 w-3.5 shrink-0"
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
            class="h-3.5 w-3.5 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M6 4.5A1.5 1.5 0 0 1 7.5 3h.25a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H7.5A1.5 1.5 0 0 1 6 15.5v-11ZM10.75 4.5A1.5 1.5 0 0 1 12.25 3h.25A1.5 1.5 0 0 1 14 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-.25a1.5 1.5 0 0 1-1.5-1.5v-11Z"
            />
          </svg>
        </button>
        <button
          :id="filtersToggleId"
          type="button"
          :class="eventFilterToggleClass"
          @click="emit('filtersToggle')"
        >
          <svg
            class="h-3.5 w-3.5"
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
          <span class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] leading-none text-zinc-500">
            {{ view.enabledCount }}
          </span>
        </button>
        <button
          :id="clearButtonId"
          type="button"
          class="h-8 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50"
          @click="emit('clear')"
        >
          Clear
        </button>
      </div>
    </div>
    <EventsList
      v-show="!filtersVisible"
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
  </aside>
</template>
