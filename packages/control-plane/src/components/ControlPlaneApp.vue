<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { provideControlPlaneActions } from '@agentg/control-plane-extension/actions';
import {
  createSlotRuntime,
  provideSlotRuntime,
  SlotDebugLayer,
  SlotOutlet
} from '@agentg/control-plane-extension/slots';
import UiButton from '@agentg/control-plane-extension/ui';

import { useControlPlaneRuntime } from '../runtime/useControlPlaneRuntime.js';
import { useAppShellStore } from '../stores/appShell.js';
import { useChatStore } from '../stores/chat.js';
import { useSelectedHistoryStore } from '../stores/selectedHistory.js';
import { appShellView } from '../view-models/appShellView.js';
import { chatSidebarView } from '../view-models/chatSidebarView.js';
import { selectedWorkspaceView } from '../view-models/selectedWorkspaceView.js';
import { controlPlaneContentCatalog } from '../composition/contentProviders.js';
import {
  defaultControlPlaneLayout,
  readControlPlaneLayout,
  writeControlPlaneLayout
} from '../composition/slots/layout.js';
import ShellStatusBadge from './ShellStatusBadge.vue';
import ShellToggleButton from './ShellToggleButton.vue';

const appShellStore = useAppShellStore();
const chatStore = useChatStore();
const selectedHistoryStore = useSelectedHistoryStore();
const actions = useControlPlaneRuntime();
const slotDebugEnabled = computed(() => appShellStore.slotDebugEnabled);
const slotRuntime = createSlotRuntime({
  catalog: controlPlaneContentCatalog,
  debugEnabled: slotDebugEnabled,
  initialLayout: readControlPlaneLayout(defaultControlPlaneLayout),
  onLayoutChange: writeControlPlaneLayout
});

provideControlPlaneActions(actions);
provideSlotRuntime(slotRuntime);

const appShell = computed(() => appShellView(appShellStore));
const chatSidebar = computed(() => chatSidebarView(chatStore, selectedHistoryStore.selectedChatId));
const selectedWorkspace = computed(() => selectedWorkspaceView(selectedHistoryStore));
const workspaceContext = computed(() => ({
  chatSidebar: chatSidebar.value,
  eventsPanelCollapsed: appShell.value.eventsPanelCollapsed,
  selectedWorkspace: selectedWorkspace.value
}));

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

function toggleSlotDebug(): void {
  appShellStore.setSlotDebugEnabled(!appShell.value.slotDebugEnabled);
}

function browserGlobal(): BrowserGlobal {
  return globalThis as unknown as BrowserGlobal;
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
            <UiButton
              :aria-pressed="appShell.slotDebugEnabled"
              class="gap-1.5 px-2.5 text-xs"
              :title="
                appShell.slotDebugEnabled ? 'Hide slot debug overlay' : 'Show slot debug overlay'
              "
              :variant="appShell.slotDebugEnabled ? 'danger' : 'neutral'"
              @click="toggleSlotDebug"
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
                <path d="M4 4h5v5H4z" />
                <path d="M11 4h5v5h-5z" />
                <path d="M4 11h5v5H4z" />
                <path d="M11 11h5v5h-5z" />
              </svg>
              <span>Slots</span>
            </UiButton>
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
      <SlotOutlet
        id="dashboardMetrics"
        slot-id="control-plane.dashboard"
        :tags="['control-plane.dashboard']"
      />
    </section>

    <main
      id="mainLayout"
      ref="mainLayout"
      class="min-h-0 flex-1 overflow-hidden bg-zinc-100 p-4 pt-0"
    >
      <SlotOutlet
        :context="workspaceContext"
        slot-id="control-plane.workspace"
        :tags="['control-plane.workspace']"
      />
    </main>
  </div>
  <section
    v-show="dashboardPreviewVisible"
    id="dashboardPreviewPanel"
    class="fixed left-0 right-0 z-40 bg-zinc-100 p-4 pt-0"
    :style="dashboardPreviewStyle"
  >
    <SlotOutlet
      id="dashboardPreviewMetrics"
      slot-id="control-plane.dashboard.preview"
      :tags="['control-plane.dashboard']"
    />
  </section>
  <section v-show="eventsPreviewVisible" class="fixed z-40" :style="eventsPreviewStyle">
    <SlotOutlet
      :context="{ idPrefix: 'eventsPreview' }"
      slot-id="control-plane.events.preview"
      :tags="['control-plane.events']"
    />
  </section>
  <SlotDebugLayer />
</template>
