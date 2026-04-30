<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useControlPlaneRuntime } from '../runtime/controlPlaneRuntime.js';
import { controlPlaneStore, useControlPlaneAppView } from '../stores/controlPlaneStore.js';
import ChatSidebar from './ChatSidebar.vue';
import DashboardMetrics from './DashboardMetrics.vue';
import EventFilters from './EventFilters.vue';
import EventsList from './EventsList.vue';
import SelectedWorkspace from './SelectedWorkspace.vue';
import ShellStatusBadge from './ShellStatusBadge.vue';
import ShellToggleButton from './ShellToggleButton.vue';

const {
  appShell,
  chatSidebar,
  dashboardMetrics,
  eventFiltersPanel,
  eventFiltersVisible,
  eventItems,
  hasEvents,
  selectedWorkspace
} = useControlPlaneAppView();
const {
  addCustomTarget,
  addPresetTarget,
  clearChatSearch,
  closeSelectedChat,
  deleteTarget,
  openArchiveChats,
  openFolderChats,
  openMainChats,
  searchChats,
  toggleChat
} = useControlPlaneRuntime();

type BrowserGlobal = {
  addEventListener: (type: string, listener: () => void) => void;
  getComputedStyle: (element: unknown) => {
    paddingBottom: string;
    paddingRight: string;
    paddingTop: string;
  };
  innerWidth: number;
  removeEventListener: (type: string, listener: () => void) => void;
};

type ShellElement = {
  getBoundingClientRect: () => {
    bottom: number;
    height: number;
    right: number;
    top: number;
  };
};

const dashboardPreviewVisible = ref(false);
const dashboardPreviewStyle = ref<Record<string, string>>({});
const eventsPreviewVisible = ref(false);
const eventsPreviewStyle = ref<Record<string, string>>({});
const header = ref<ShellElement | null>(null);
const mainLayout = ref<ShellElement | null>(null);

const eventFilterToggleClass = computed(() =>
  eventFiltersVisible.value
    ? 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-800 px-2.5 text-sm font-medium text-white hover:bg-zinc-950'
    : 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50'
);

const mainLayoutClass = computed(() =>
  appShell.value.eventsPanelCollapsed
    ? 'grid min-h-0 flex-1 grid-cols-[380px_minmax(0,1fr)] gap-4 overflow-hidden bg-zinc-100 p-4 pt-0'
    : 'grid min-h-0 flex-1 grid-cols-[380px_minmax(0,1fr)_400px] gap-4 overflow-hidden bg-zinc-100 p-4 pt-0'
);

function clearEvents(): void {
  controlPlaneStore.clearEvents();
}

function hideDashboardPreview(): void {
  dashboardPreviewVisible.value = false;
}

function hideEventsPreview(): void {
  eventsPreviewVisible.value = false;
}

function positionDashboardPreview(): void {
  const headerElement = header.value;
  if (!headerElement) return;
  const headerRect = headerElement.getBoundingClientRect();
  dashboardPreviewStyle.value = {
    top: `${String(headerRect.bottom)}px`
  };
}

function positionEventsPreview(): void {
  const mainElement = mainLayout.value;
  if (!mainElement) return;
  const rect = mainElement.getBoundingClientRect();
  const browser = browserGlobal();
  const styles = browser.getComputedStyle(mainElement);
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
  const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
  eventsPreviewStyle.value = {
    height: `${String(Math.max(160, rect.height - paddingTop - paddingBottom))}px`,
    right: `${String(browser.innerWidth - rect.right + paddingRight)}px`,
    top: `${String(rect.top + paddingTop)}px`,
    width: '400px'
  };
}

function repositionVisiblePreviews(): void {
  if (dashboardPreviewVisible.value) {
    positionDashboardPreview();
  }
  if (eventsPreviewVisible.value) {
    positionEventsPreview();
  }
}

function showDashboardPreview(): void {
  if (!appShell.value.dashboardCollapsed) return;
  positionDashboardPreview();
  dashboardPreviewVisible.value = true;
}

function showEventsPreview(): void {
  if (!appShell.value.eventsPanelCollapsed) return;
  positionEventsPreview();
  eventsPreviewVisible.value = true;
}

function toggleDashboardPanel(): void {
  const collapsed = !appShell.value.dashboardCollapsed;
  controlPlaneStore.setDashboardCollapsed(collapsed);
  if (!collapsed) {
    hideDashboardPreview();
  }
}

function toggleEventsPanel(): void {
  const collapsed = !appShell.value.eventsPanelCollapsed;
  controlPlaneStore.setEventsPanelCollapsed(collapsed);
  if (!collapsed) {
    hideEventsPreview();
  }
}

function browserGlobal(): BrowserGlobal {
  return globalThis as unknown as BrowserGlobal;
}

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

function clearTimelineScale(): void {
  controlPlaneStore.setViewportDays(null);
}

function selectTimelineScale(value: number): void {
  if (controlPlaneStore.state.viewportDays === value) {
    controlPlaneStore.setDefaultViewportDays(value);
  }
  controlPlaneStore.setViewportDays(value);
}

onMounted(() => {
  browserGlobal().addEventListener('resize', repositionVisiblePreviews);
});

onBeforeUnmount(() => {
  browserGlobal().removeEventListener('resize', repositionVisiblePreviews);
});
</script>

<template>
  <div class="flex h-screen min-h-0 flex-col">
    <header ref="header" class="shrink-0 bg-zinc-100 px-4 py-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <h1 class="truncate text-lg font-semibold tracking-normal">AgenTG Control Plane</h1>
        </div>
        <div class="flex flex-wrap items-center justify-end gap-3">
          <div class="flex flex-wrap items-center justify-end gap-2">
            <ShellStatusBadge :badge="appShell.gatewayStatus" />
            <ShellStatusBadge :badge="appShell.tdlibStatus" />
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2">
            <ShellToggleButton
              :active="!appShell.dashboardCollapsed"
              icon="dashboard"
              label="Dashboard"
              title-active="Hide dashboard"
              title-inactive="Show dashboard"
              @preview-enter="showDashboardPreview"
              @preview-leave="hideDashboardPreview"
              @toggle="toggleDashboardPanel"
            />
            <ShellToggleButton
              :active="!appShell.eventsPanelCollapsed"
              icon="events"
              label="Events"
              title-active="Hide events"
              title-inactive="Show events"
              @preview-enter="showEventsPreview"
              @preview-leave="hideEventsPreview"
              @toggle="toggleEventsPanel"
            />
          </div>
        </div>
      </div>
    </header>

    <section
      v-show="!appShell.dashboardCollapsed"
      id="dashboardPanel"
      class="shrink-0 bg-zinc-100 p-4 pt-0"
    >
      <DashboardMetrics id="dashboardMetrics" :metrics="dashboardMetrics" />
    </section>

    <main id="mainLayout" ref="mainLayout" :class="mainLayoutClass">
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
        @delete-target="deleteTarget"
        @freeform-scale="clearTimelineScale"
        @preset-target="addPresetTarget"
        @scale-select="selectTimelineScale"
      />

      <aside
        v-show="!appShell.eventsPanelCollapsed"
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
              @click="clearEvents"
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
  <section
    v-show="dashboardPreviewVisible"
    id="dashboardPreviewPanel"
    class="fixed left-0 right-0 z-40 bg-zinc-100 p-4 pt-0"
    :style="dashboardPreviewStyle"
  >
    <DashboardMetrics id="dashboardPreviewMetrics" :metrics="dashboardMetrics" />
  </section>
  <aside
    v-show="eventsPreviewVisible"
    id="eventsPreviewPanel"
    class="fixed z-40 flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white"
    :style="eventsPreviewStyle"
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
          type="button"
          class="h-8 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50"
          @click="clearEvents"
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
