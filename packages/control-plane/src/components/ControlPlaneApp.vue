<script setup lang="ts">
import { computed, onMounted } from 'vue';

import {
  addCustomTarget,
  addPresetTarget,
  clearChatSearch,
  closeSelectedChat,
  mountControlPlaneAppRuntime,
  openArchiveChats,
  openFolderChats,
  openMainChats,
  searchChats,
  selectTimelineScale,
  toggleChat,
  useControlPlaneAppView
} from '../app-runtime.js';
import { controlPlaneStore } from '../stores/controlPlaneStore.js';
import ChatSidebar from './ChatSidebar.vue';
import DashboardMetrics from './DashboardMetrics.vue';
import EventFilters from './EventFilters.vue';
import EventsList from './EventsList.vue';
import SelectedWorkspace from './SelectedWorkspace.vue';

const {
  chatSidebar,
  dashboardMetrics,
  eventFiltersPanel,
  eventFiltersVisible,
  eventItems,
  hasEvents,
  selectedWorkspace
} = useControlPlaneAppView();

const eventFilterToggleClass = computed(() =>
  eventFiltersVisible.value
    ? 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-800 px-2.5 text-sm font-medium text-white hover:bg-zinc-950'
    : 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50'
);

function toggleEventFilters(): void {
  controlPlaneStore.toggleEventsPanelMode();
}

function closeEventFilters(): void {
  controlPlaneStore.setEventsPanelMode('events');
}

function setEventGroupEnabled(groupId: string, enabled: boolean): void {
  controlPlaneStore.setEventGroupEnabled(groupId, enabled);
}

function setEventLimit(value: string): void {
  controlPlaneStore.setEventLimit(value);
}

function setEventTypeEnabled(type: string, enabled: boolean): void {
  controlPlaneStore.setEventTypeEnabled(type, enabled);
}

onMounted(() => {
  mountControlPlaneAppRuntime();
});
</script>

<template>
  <div class="flex h-screen min-h-0 flex-col">
    <header class="shrink-0 bg-zinc-100 px-4 py-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <h1 class="truncate text-lg font-semibold tracking-normal">AgenTG Control Plane</h1>
        </div>
        <div class="flex flex-wrap items-center justify-end gap-3">
          <div class="flex flex-wrap items-center justify-end gap-2">
            <span
              id="wsStatus"
              class="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600"
            ></span>
            <span
              id="tdlibStatus"
              class="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600"
            ></span>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2">
            <button
              id="toggleDashboardTop"
              type="button"
              aria-pressed="true"
              class="group inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
              title="Toggle dashboard"
            >
              <span
                data-preview-trigger
                class="relative inline-flex h-3.5 w-3.5 items-center justify-center"
              >
                <svg
                  data-action-icon
                  class="h-3.5 w-3.5"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 3h5v5H3z" />
                  <path d="M12 3h5v5h-5z" />
                  <path d="M3 12h5v5H3z" />
                  <path d="M12 12h5v5h-5z" />
                </svg>
                <svg
                  data-preview-icon
                  class="absolute hidden h-3.5 w-3.5 group-hover:block"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2.5 10S5.5 5 10 5s7.5 5 7.5 5-3 5-7.5 5-7.5-5-7.5-5Z" />
                  <path d="M10 8.25a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5Z" />
                </svg>
              </span>
              <span>Dashboard</span>
            </button>
            <button
              id="toggleEventsPanelTop"
              type="button"
              aria-pressed="true"
              class="group inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
              title="Toggle events"
            >
              <span
                data-preview-trigger
                class="relative inline-flex h-3.5 w-3.5 items-center justify-center"
              >
                <svg
                  data-action-icon
                  class="h-3.5 w-3.5"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 5h12" />
                  <path d="M4 10h12" />
                  <path d="M4 15h8" />
                </svg>
                <svg
                  data-preview-icon
                  class="absolute hidden h-3.5 w-3.5 group-hover:block"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2.5 10S5.5 5 10 5s7.5 5 7.5 5-3 5-7.5 5-7.5-5-7.5-5Z" />
                  <path d="M10 8.25a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5Z" />
                </svg>
              </span>
              <span>Events</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <section id="dashboardPanel" class="shrink-0 bg-zinc-100 p-4 pt-0">
      <DashboardMetrics id="dashboardMetrics" :metrics="dashboardMetrics" />
    </section>

    <main
      id="mainLayout"
      class="grid min-h-0 flex-1 grid-cols-[380px_minmax(0,1fr)_400px] gap-4 overflow-hidden bg-zinc-100 p-4 pt-0"
    >
      <ChatSidebar
        :view="chatSidebar"
        @archive-open="openArchiveChats"
        @chat-toggle="toggleChat"
        @folder-open="openFolderChats"
        @main-open="openMainChats"
        @search-clear="clearChatSearch"
        @search-input="searchChats"
      />

      <SelectedWorkspace
        :view="selectedWorkspace"
        @close="closeSelectedChat"
        @custom-target="addCustomTarget"
        @preset-target="addPresetTarget"
        @scale-select="selectTimelineScale"
      />

      <aside
        id="eventsPanel"
        class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white"
      >
        <div class="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 p-3">
          <div>
            <div class="text-sm font-semibold">Events</div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <button
              id="eventFiltersToggle"
              type="button"
              :class="eventFilterToggleClass"
              @click="toggleEventFilters"
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
              <span
                class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] leading-none text-zinc-500"
              >
                {{ eventFiltersPanel.enabledCount }}
              </span>
            </button>
            <button
              id="clearEvents"
              class="h-8 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50"
            >
              Clear
            </button>
          </div>
        </div>
        <EventsList
          v-show="!eventFiltersVisible"
          id="events"
          :events="eventItems"
          :has-events="hasEvents"
        />
        <EventFilters
          v-show="eventFiltersVisible"
          id="eventFilters"
          :view="eventFiltersPanel"
          @close="closeEventFilters"
          @group-change="setEventGroupEnabled"
          @limit-change="setEventLimit"
          @type-change="setEventTypeEnabled"
        />
      </aside>
    </main>
  </div>
  <div id="coverageHoverPanel" class="app-hover-stack hidden"></div>
  <section id="dashboardPreviewPanel" class="fixed left-0 right-0 z-40 hidden bg-zinc-100 p-4 pt-0">
    <DashboardMetrics id="dashboardPreviewMetrics" :metrics="dashboardMetrics" />
  </section>
  <aside
    id="eventsPreviewPanel"
    class="fixed z-40 hidden min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white"
  >
    <div class="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 p-3">
      <div>
        <div class="text-sm font-semibold">Events</div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button type="button" :class="eventFilterToggleClass" @click="toggleEventFilters">
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
            {{ eventFiltersPanel.enabledCount }}
          </span>
        </button>
        <button
          data-preview-clear-events
          class="h-8 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50"
        >
          Clear
        </button>
      </div>
    </div>
    <EventsList
      v-show="!eventFiltersVisible"
      id="eventsPreview"
      :events="eventItems"
      :has-events="hasEvents"
    />
    <EventFilters
      v-show="eventFiltersVisible"
      id="eventFiltersPreview"
      :view="eventFiltersPanel"
      @close="closeEventFilters"
      @group-change="setEventGroupEnabled"
      @limit-change="setEventLimit"
      @type-change="setEventTypeEnabled"
    />
  </aside>
</template>
