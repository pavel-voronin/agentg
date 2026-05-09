<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { provideControlPlaneHost } from '@agentg/control-plane-sdk/host';
import {
  createSlotRuntime,
  provideSlotRuntime,
  SlotDebugLayer,
  SlotOutlet
} from '@agentg/control-plane-sdk/slots';
import UiButton from '@agentg/control-plane-sdk/ui';
import UiStatusBadge from '@agentg/control-plane-sdk/ui/status-badge';

import { useControlPlaneRuntime } from '../runtime/useControlPlaneRuntime.js';
import { useAppShellStore } from '../stores/appShell.js';
import { appShellView } from '../view-models/appShellView.js';
import {
  controlPlaneContentCatalog,
  controlPlaneContentProviders,
  contentCatalogFromProviders,
  loadRuntimeContentProviders
} from '../composition/contentProviders.js';
import { controlPlaneSlotLayout } from '../composition/slots/manifest.js';
import DashboardPanel from './DashboardPanel.vue';
import ShellToggleButton from './ShellToggleButton.vue';

const appShellStore = useAppShellStore();
const host = useControlPlaneRuntime();
const slotDebugEnabled = computed(() => appShellStore.slotDebugEnabled);
const slotRuntime = createSlotRuntime({
  catalog: controlPlaneContentCatalog,
  debugEnabled: slotDebugEnabled,
  initialLayout: controlPlaneSlotLayout
});

provideControlPlaneHost(host);
provideSlotRuntime(slotRuntime);

const appShell = computed(() => appShellView(appShellStore));
const workspaceContext = computed(() => ({
  eventsPanelCollapsed: appShell.value.eventsPanelCollapsed
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
let lastContentCatalogVersion: number | null = null;
let unsubscribeDirectoryEvents: (() => void) | null = null;

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

async function refreshRuntimeContentProviders(): Promise<void> {
  const runtimeCatalog = await loadRuntimeContentProviders();
  if (runtimeCatalog.version === lastContentCatalogVersion) {
    return;
  }
  lastContentCatalogVersion = runtimeCatalog.version;
  const providers = [...controlPlaneContentProviders, ...runtimeCatalog.providers];
  slotRuntime.replaceCatalog(contentCatalogFromProviders(providers));
}

function scheduleRuntimeContentProvidersRefresh(): void {
  void refreshRuntimeContentProviders().catch((error: unknown) => {
    console.error(error);
  });
}

function browserGlobal(): BrowserGlobal {
  return globalThis as unknown as BrowserGlobal;
}

onMounted(() => {
  browserGlobal().addEventListener('resize', repositionVisiblePreviews);
  unsubscribeDirectoryEvents = host.subscribeEvents((event) => {
    if (event.type === 'service_directory.changed') {
      scheduleRuntimeContentProvidersRefresh();
    }
  });
  scheduleRuntimeContentProvidersRefresh();
});

onBeforeUnmount(() => {
  browserGlobal().removeEventListener('resize', repositionVisiblePreviews);
  unsubscribeDirectoryEvents?.();
  unsubscribeDirectoryEvents = null;
});
</script>

<template>
  <div class="control-plane-app">
    <header ref="header" class="control-plane-app__header">
      <div class="control-plane-app__header-layout">
        <div class="control-plane-app__title-frame">
          <h1 class="control-plane-app__title">AgenTG Control Plane</h1>
        </div>
        <div class="control-plane-app__toolbar">
          <div class="control-plane-app__status-group">
            <UiStatusBadge
              :kind="appShell.controlPlaneStatus.kind"
              :label="appShell.controlPlaneStatus.label"
            />
            <SlotOutlet
              slot-id="control-plane.header.status"
              :tags="['control-plane.header.status']"
            />
          </div>
          <div class="control-plane-app__toggle-group">
            <UiButton
              :aria-pressed="appShell.slotDebugEnabled"
              class="control-plane-app__slot-debug-button"
              :title="
                appShell.slotDebugEnabled ? 'Hide slot debug overlay' : 'Show slot debug overlay'
              "
              :variant="appShell.slotDebugEnabled ? 'danger' : 'neutral'"
              @click="toggleSlotDebug"
            >
              <svg
                class="control-plane-app__button-icon"
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
      v-if="!appShell.dashboardCollapsed"
      id="dashboardPanel"
      class="control-plane-app__dashboard-panel"
    >
      <DashboardPanel />
    </section>

    <main id="mainLayout" ref="mainLayout" class="control-plane-app__main-layout">
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
    class="control-plane-app__dashboard-preview"
    :style="dashboardPreviewStyle"
  >
    <DashboardPanel />
  </section>
  <section
    v-show="eventsPreviewVisible"
    class="control-plane-app__events-preview"
    :style="eventsPreviewStyle"
  >
    <SlotOutlet
      :context="{ idPrefix: 'eventsPreview' }"
      slot-id="control-plane.events.preview"
      :tags="['control-plane.events']"
    />
  </section>
  <SlotDebugLayer />
</template>

<style scoped>
@reference "tailwindcss";
.control-plane-app {
  @apply flex h-screen min-h-0 flex-col;
}

.control-plane-app__header {
  @apply shrink-0 bg-zinc-100 px-4 py-3;
}

.control-plane-app__header-layout {
  @apply flex flex-wrap items-center justify-between gap-3;
}

.control-plane-app__title-frame {
  @apply min-w-0;
}

.control-plane-app__title {
  @apply truncate text-lg font-semibold tracking-normal;
}

.control-plane-app__toolbar {
  @apply flex flex-wrap items-center justify-end gap-3;
}

.control-plane-app__status-group,
.control-plane-app__toggle-group {
  @apply flex flex-wrap items-center justify-end gap-2;
}

.control-plane-app__slot-debug-button {
  @apply gap-1.5 px-2.5 text-xs;
}

.control-plane-app__button-icon {
  @apply h-3.5 w-3.5;
}

.control-plane-app__dashboard-panel {
  @apply shrink-0 bg-zinc-100 p-4 pt-0;
}

.control-plane-app__main-layout {
  @apply min-h-0 flex-1 overflow-hidden bg-zinc-100 p-4 pt-0;
}

.control-plane-app__dashboard-preview {
  @apply fixed left-0 right-0 z-40 bg-zinc-100 p-4 pt-0;
}

.control-plane-app__events-preview {
  @apply fixed z-40;
}
</style>
