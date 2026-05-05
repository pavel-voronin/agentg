<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useControlPlaneRuntime } from '../runtime/useControlPlaneRuntime.js';
import { useAppShellStore } from '../stores/appShell.js';
import { useChatStore } from '../stores/chat.js';
import { useEventsStore } from '../stores/events.js';
import { useOverviewStore } from '../stores/overview.js';
import { useSelectedHistoryStore } from '../stores/selectedHistory.js';
import { appShellView } from '../view-models/appShellView.js';
import { chatSidebarView } from '../view-models/chatSidebarView.js';
import { dashboardMetricsFromOverview } from '../view-models/dashboardView.js';
import { eventFiltersPanelView, eventListItems } from '../view-models/eventsPanelView.js';
import { selectedWorkspaceView } from '../view-models/selectedWorkspaceView.js';
import ChatSidebar from './ChatSidebar.vue';
import DashboardMetrics from './DashboardMetrics.vue';
import EventsPanel from './EventsPanel.vue';
import SelectedWorkspace from './SelectedWorkspace.vue';
import ShellStatusBadge from './ShellStatusBadge.vue';
import ShellToggleButton from './ShellToggleButton.vue';

const appShellStore = useAppShellStore();
const chatStore = useChatStore();
const eventsStore = useEventsStore();
const overviewStore = useOverviewStore();
const selectedHistoryStore = useSelectedHistoryStore();
const appShell = computed(() => appShellView(appShellStore));
const chatSidebar = computed(() => chatSidebarView(chatStore, selectedHistoryStore.selectedChatId));
const dashboardMetrics = computed(() => dashboardMetricsFromOverview(overviewStore.overview));
const eventFiltersPanel = computed(() => eventFiltersPanelView(eventsStore));
const eventLimit = computed(() => eventsStore.eventLimit);
const eventsPanelMode = computed(() => eventsStore.eventsPanelMode);
const eventItems = computed(() =>
  eventListItems(eventsStore.events, (type) => eventsStore.isEventTypeMuted(type))
);
const eventsPaused = computed(() => eventsStore.eventsPaused);
const hasEvents = computed(() => eventsStore.events.length > 0);
const selectedWorkspace = computed(() => selectedWorkspaceView(selectedHistoryStore));
const {
  addCustomTarget,
  addPresetTarget,
  clearChatSearch,
  closeSelectedChat,
  deleteTarget,
  openArchiveChats,
  openChat,
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

const mainLayoutClass = computed(() =>
  appShell.value.eventsPanelCollapsed
    ? 'grid min-h-0 flex-1 grid-cols-[380px_minmax(0,1fr)] gap-4 overflow-hidden bg-zinc-100 p-4 pt-0'
    : 'grid min-h-0 flex-1 grid-cols-[380px_minmax(0,1fr)_420px] gap-4 overflow-hidden bg-zinc-100 p-4 pt-0'
);

function clearEvents(): void {
  eventsStore.clearEvents();
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
    width: '420px'
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
  appShellStore.setDashboardCollapsed(collapsed);
  if (!collapsed) {
    hideDashboardPreview();
  }
}

function toggleEventsPanel(): void {
  const collapsed = !appShell.value.eventsPanelCollapsed;
  appShellStore.setEventsPanelCollapsed(collapsed);
  if (!collapsed) {
    hideEventsPreview();
  }
}

function browserGlobal(): BrowserGlobal {
  return globalThis as unknown as BrowserGlobal;
}

function toggleEventFilters(): void {
  eventsStore.toggleEventsPanelMode('filters');
}

function toggleEventSettings(): void {
  eventsStore.toggleEventsPanelMode('settings');
}

function toggleEventStream(): void {
  eventsStore.toggleEventsPaused();
}

function closeEventFilters(): void {
  eventsStore.setEventsPanelMode('events');
}

function closeEventSettings(): void {
  eventsStore.setEventsPanelMode('events');
}

function setEventLimit(value: number): void {
  eventsStore.setEventLimit(value);
}

function setEventTypeEnabled(type: string, enabled: boolean): void {
  eventsStore.setEventTypeEnabled(type, enabled);
}

function setEventTypeMuted(type: string, muted: boolean): void {
  eventsStore.setEventTypeMuted(type, muted);
}

function clearEventsOfType(type: string): void {
  eventsStore.clearEventsOfType(type);
}

function clearTimelineScale(): void {
  selectedHistoryStore.setViewportDays(null);
}

function selectTimelineScale(value: number): void {
  if (selectedHistoryStore.viewportDays === value) {
    selectedHistoryStore.setDefaultViewportDays(value);
  }
  selectedHistoryStore.setViewportDays(value);
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
            <ShellStatusBadge :badge="appShell.controlPlaneStatus" />
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
        @chat-open="openChat"
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

      <EventsPanel
        v-show="!appShell.eventsPanelCollapsed"
        clear-button-id="clearEvents"
        event-filters-id="eventFilters"
        event-list-id="events"
        :event-limit="eventLimit"
        event-settings-id="eventSettings"
        filters-toggle-id="eventFiltersToggle"
        :events="eventItems"
        :has-events="hasEvents"
        :mode="eventsPanelMode"
        panel-id="eventsPanel"
        settings-toggle-id="eventSettingsToggle"
        :stream-paused="eventsPaused"
        stream-toggle-id="eventStreamToggle"
        :view="eventFiltersPanel"
        @clear="clearEvents"
        @clear-type="clearEventsOfType"
        @close-filters="closeEventFilters"
        @close-settings="closeEventSettings"
        @event-limit-change="setEventLimit"
        @filters-toggle="toggleEventFilters"
        @mute-change="setEventTypeMuted"
        @settings-toggle="toggleEventSettings"
        @stream-toggle="toggleEventStream"
        @type-change="setEventTypeEnabled"
      />
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
  <EventsPanel
    v-show="eventsPreviewVisible"
    class="fixed z-40"
    event-filters-id="eventFiltersPreview"
    event-list-id="eventsPreview"
    :event-limit="eventLimit"
    event-settings-id="eventSettingsPreview"
    :events="eventItems"
    :has-events="hasEvents"
    :mode="eventsPanelMode"
    panel-id="eventsPreviewPanel"
    :stream-paused="eventsPaused"
    :style="eventsPreviewStyle"
    :view="eventFiltersPanel"
    @clear="clearEvents"
    @clear-type="clearEventsOfType"
    @close-filters="closeEventFilters"
    @close-settings="closeEventSettings"
    @event-limit-change="setEventLimit"
    @filters-toggle="toggleEventFilters"
    @mute-change="setEventTypeMuted"
    @settings-toggle="toggleEventSettings"
    @stream-toggle="toggleEventStream"
    @type-change="setEventTypeEnabled"
  />
</template>
