<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import SolarWidget2Bold from '~icons/solar/widget-2-bold';

import { provideDashboardHost } from '@agentg/framework/dashboard';
import {
  createSlotRuntime,
  provideSlotRuntime,
  SlotDebugLayer,
  SlotOutlet
} from '@agentg/framework/dashboard';
import { UiButton, UiPage } from '@agentg/framework/dashboard';

import { useDashboardRuntime } from '../runtime/useDashboardRuntime.js';
import { useAppShellStore } from '../stores/appShell.js';
import { DEFAULT_PAGE_SEGMENT, pathForRoute, routeFromPathname } from '../stores/shellRoute.js';
import { shellPageContributions } from '../view-models/pageContributions.js';
import { dashboardContentCatalog } from '../composition/contentProviders.js';
import { dashboardSlotLayout } from '../composition/slots/manifest.js';
import IconifyIcon from './iconifyIcon.vue';

const appShellStore = useAppShellStore();
const host = useDashboardRuntime();
const slotDebugEnabled = computed(() => appShellStore.slotDebugEnabled);
const slotRuntime = createSlotRuntime({
  catalog: dashboardContentCatalog,
  debugEnabled: slotDebugEnabled,
  initialLayout: dashboardSlotLayout
});

provideDashboardHost(host);
provideSlotRuntime(slotRuntime);

const pageContributions = computed(() =>
  shellPageContributions(slotRuntime.compatibleContent(['dashboard.page']))
);
const defaultPageContribution = computed(
  () => pageContributions.value.find((page) => page.isDefault) ?? pageContributions.value[0] ?? null
);
const defaultPageSegment = computed(
  () => defaultPageContribution.value?.routeSegment ?? DEFAULT_PAGE_SEGMENT
);
const routePath = computed(() => pathForRoute(appShellStore.route, defaultPageSegment.value));
const activePageSegment = computed(() => appShellStore.route.pageSegment);
const activePageContribution = computed(
  () =>
    pageContributions.value.find((page) => page.routeSegment === activePageSegment.value) ?? null
);
const pageContext = computed(() => ({
  routeSegments: appShellStore.route.segments,
  setRouteSegments: setPageRouteSegments
}));

type BrowserGlobal = {
  addEventListener: (type: 'popstate', listener: () => void) => void;
  history: {
    pushState: (data: unknown, title: string, url?: string | URL | null) => void;
    replaceState: (data: unknown, title: string, url?: string | URL | null) => void;
  };
  location: {
    hash: string;
    pathname: string;
    search: string;
  };
  removeEventListener: (type: 'popstate', listener: () => void) => void;
};

function showPage(pageSegment: string): void {
  appShellStore.setPageRoute(pageSegment);
}

function setPageRouteSegments(segments: readonly string[]): void {
  appShellStore.setPageRouteSegments(segments);
}

function toggleSlotDebug(): void {
  appShellStore.setSlotDebugEnabled(!appShellStore.slotDebugEnabled);
}

function browserGlobal(): BrowserGlobal {
  return globalThis as unknown as BrowserGlobal;
}

function syncRouteFromBrowser(): void {
  const route = routeFromPathname(browserGlobal().location.pathname, defaultPageSegment.value);
  appShellStore.setRoute(route);
}

function syncBrowserRoute(path: string, replace: boolean): void {
  const browser = browserGlobal();
  if (
    browser.location.pathname === path &&
    browser.location.search === '' &&
    browser.location.hash === ''
  ) {
    return;
  }
  if (replace) {
    browser.history.replaceState(null, '', path);
    return;
  }
  browser.history.pushState(null, '', path);
}

watch(
  routePath,
  (path, previousPath) => {
    syncBrowserRoute(path, previousPath === undefined);
  },
  { immediate: true }
);

onMounted(() => {
  browserGlobal().addEventListener('popstate', syncRouteFromBrowser);
});

onBeforeUnmount(() => {
  browserGlobal().removeEventListener('popstate', syncRouteFromBrowser);
});
</script>

<template>
  <div class="dashboard-app">
    <header class="dashboard-app__header">
      <div class="dashboard-app__header-layout">
        <div class="dashboard-app__title-frame">
          <h1 class="dashboard-app__title">AgenTG Dashboard</h1>
          <nav class="dashboard-app__nav-group" aria-label="Dashboard pages">
            <UiButton
              v-for="page in pageContributions"
              :key="page.contentId"
              :aria-current="
                activePageContribution?.contentId === page.contentId ? 'page' : undefined
              "
              class="dashboard-app__page-button"
              :title="page.label"
              :variant="
                activePageContribution?.contentId === page.contentId ? 'selected' : 'neutral'
              "
              @click="showPage(page.routeSegment)"
            >
              <IconifyIcon :icon="page.icon" />
              <span>{{ page.label }}</span>
            </UiButton>
          </nav>
        </div>
        <div class="dashboard-app__toolbar">
          <div class="dashboard-app__action-group">
            <SlotOutlet slot-id="dashboard.header.actions" :tags="['dashboard.header.actions']" />
          </div>
          <div class="dashboard-app__status-group">
            <SlotOutlet slot-id="dashboard.header.status" :tags="['dashboard.header.status']" />
          </div>
          <div class="dashboard-app__toggle-group">
            <UiButton
              :aria-pressed="appShellStore.slotDebugEnabled"
              class="dashboard-app__slot-debug-button"
              :title="
                appShellStore.slotDebugEnabled
                  ? 'Hide slot debug overlay'
                  : 'Show slot debug overlay'
              "
              :variant="appShellStore.slotDebugEnabled ? 'danger' : 'neutral'"
              @click="toggleSlotDebug"
            >
              <SolarWidget2Bold class="dashboard-app__button-icon" aria-hidden="true" />
              <span>Slots</span>
            </UiButton>
          </div>
        </div>
      </div>
    </header>

    <main id="mainLayout" class="dashboard-app__page-layout">
      <SlotOutlet
        v-if="activePageContribution !== null"
        :content-id="activePageContribution.contentId"
        :context="pageContext"
        slot-id="dashboard.page"
        :tags="['dashboard.page']"
      >
        <UiPage>
          <div class="dashboard-app__empty-page">No page contribution is available.</div>
        </UiPage>
      </SlotOutlet>
      <UiPage v-else>
        <div class="dashboard-app__empty-page">No page contribution is available.</div>
      </UiPage>
    </main>
  </div>
  <SlotDebugLayer />
</template>

<style scoped>
@reference "tailwindcss";
.dashboard-app {
  @apply flex h-screen min-h-0 flex-col;
}

.dashboard-app__header {
  @apply shrink-0 bg-zinc-100 px-4 py-3;
}

.dashboard-app__header-layout {
  @apply flex flex-wrap items-center justify-between gap-3;
}

.dashboard-app__title-frame {
  @apply flex min-w-0 flex-wrap items-center gap-3;
}

.dashboard-app__title {
  @apply truncate text-lg font-semibold tracking-normal;
}

.dashboard-app__toolbar {
  @apply flex flex-wrap items-center justify-end gap-3;
}

.dashboard-app__action-group {
  @apply flex flex-wrap items-center justify-end gap-2;
}

.dashboard-app__status-group {
  @apply flex flex-wrap items-center justify-end gap-1;
}

.dashboard-app__toggle-group {
  @apply flex flex-wrap items-center justify-end gap-2;
}

.dashboard-app__nav-group {
  @apply flex flex-wrap items-center justify-start gap-2;
}

.dashboard-app__page-button {
  @apply gap-1.5 px-2.5 text-xs;
}

.dashboard-app__slot-debug-button {
  @apply gap-1.5 px-2.5 text-xs;
}

.dashboard-app__button-icon {
  @apply h-3.5 w-3.5;
}

.dashboard-app__page-layout {
  @apply flex min-h-0 flex-1 overflow-hidden bg-zinc-100 p-4 pt-0;
}

.dashboard-app__empty-page {
  @apply flex min-h-0 flex-1 items-center justify-center text-sm text-zinc-500;
}
</style>
