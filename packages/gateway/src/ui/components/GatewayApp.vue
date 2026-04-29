<script setup lang="ts">
import { onMounted } from 'vue';

import { mountGatewayAppRuntime, useGatewayAppView } from '../app-runtime.js';
import DashboardMetrics from './DashboardMetrics.vue';
import EventsList from './EventsList.vue';

const { dashboardMetrics, eventItems, hasEvents } = useGatewayAppView();

onMounted(() => {
  mountGatewayAppRuntime();
});
</script>

<template>
  <div class="flex h-screen min-h-0 flex-col">
    <header class="shrink-0 bg-zinc-100 px-4 py-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <h1 class="truncate text-base font-semibold tracking-normal">AgenTG Gateway UI</h1>
          <div class="text-xs text-zinc-500">
            Chats, messages, targets, coverage, jobs, and events
          </div>
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
      <aside
        class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white"
      >
        <div class="grid shrink-0 gap-2 border-b border-zinc-200 p-3">
          <div class="relative">
            <input
              id="chatSearch"
              class="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-3 pr-9 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              placeholder="Search title or id"
            />
            <button
              id="chatSearchClear"
              type="button"
              aria-label="Clear search"
              title="Clear search"
              class="absolute right-2 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-lg leading-none text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              ×
            </button>
          </div>
        </div>
        <div class="grid min-h-0 flex-1 grid-cols-[76px_minmax(0,1fr)] overflow-hidden">
          <nav id="chatFolders" class="min-h-0 overflow-auto bg-slate-800"></nav>
          <div id="chatList" class="min-h-0 overflow-auto"></div>
        </div>
      </aside>

      <section
        id="workspaceShell"
        class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white"
      >
        <div id="selectedPanel" class="min-h-0 flex-1 overflow-auto"></div>
      </section>

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
              data-event-filter-toggle
              type="button"
              class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
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
                data-event-filter-count
                class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] leading-none text-zinc-500"
                >0/0</span
              >
            </button>
            <button
              id="clearEvents"
              class="h-8 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50"
            >
              Clear
            </button>
          </div>
        </div>
        <EventsList id="events" :events="eventItems" :has-events="hasEvents" />
        <div id="eventFilters" class="hidden min-h-0 flex-1 overflow-auto bg-white"></div>
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
        <button
          data-preview-filter-events
          data-event-filter-toggle
          type="button"
          class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
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
            data-event-filter-count
            class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] leading-none text-zinc-500"
            >0/0</span
          >
        </button>
        <button
          data-preview-clear-events
          class="h-8 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50"
        >
          Clear
        </button>
      </div>
    </div>
    <EventsList id="eventsPreview" :events="eventItems" :has-events="hasEvents" />
    <div id="eventFiltersPreview" class="hidden min-h-0 flex-1 overflow-auto bg-white"></div>
  </aside>
</template>
