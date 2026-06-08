<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import SolarWidget2Bold from '~icons/solar/widget-2-bold';

import { provideControlPlaneHost } from '@agentg/framework/cp';
import {
  createSlotRuntime,
  provideSlotRuntime,
  SlotDebugLayer,
  SlotOutlet
} from '@agentg/framework/cp';
import { UiButton } from '@agentg/framework/cp';

import { useControlPlaneRuntime } from '../runtime/useControlPlaneRuntime.js';
import { useAppShellStore } from '../stores/appShell.js';
import { DEFAULT_PAGE_SEGMENT, pathForRoute, routeFromPathname } from '../stores/shellRoute.js';
import { shellPageContributions } from '../view-models/pageContributions.js';
import { controlPlaneContentCatalog } from '../composition/contentProviders.js';
import { controlPlaneSlotLayout } from '../composition/slots/manifest.js';
import IconifyIcon from './iconifyIcon.vue';

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

const pageContributions = computed(() =>
  shellPageContributions(slotRuntime.compatibleContent(['control-plane.page']))
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
  if (browser.location.pathname === path) {
    return;
  }
  const url = `${path}${browser.location.search}${browser.location.hash}`;
  if (replace) {
    browser.history.replaceState(null, '', url);
    return;
  }
  browser.history.pushState(null, '', url);
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
  <div class="control-plane-app">
    <header class="control-plane-app__header">
      <div class="control-plane-app__header-layout">
        <div class="control-plane-app__title-frame">
          <h1 class="control-plane-app__title">AgenTG Control Plane</h1>
          <nav class="control-plane-app__nav-group" aria-label="Control Plane pages">
            <UiButton
              v-for="page in pageContributions"
              :key="page.contentId"
              :aria-current="
                activePageContribution?.contentId === page.contentId ? 'page' : undefined
              "
              class="control-plane-app__page-button"
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
        <div class="control-plane-app__toolbar">
          <div class="control-plane-app__action-group">
            <SlotOutlet
              slot-id="control-plane.header.actions"
              :tags="['control-plane.header.actions']"
            />
          </div>
          <div class="control-plane-app__status-group">
            <SlotOutlet
              slot-id="control-plane.header.status"
              :tags="['control-plane.header.status']"
            />
          </div>
          <div class="control-plane-app__toggle-group">
            <UiButton
              :aria-pressed="appShellStore.slotDebugEnabled"
              class="control-plane-app__slot-debug-button"
              :title="
                appShellStore.slotDebugEnabled
                  ? 'Hide slot debug overlay'
                  : 'Show slot debug overlay'
              "
              :variant="appShellStore.slotDebugEnabled ? 'danger' : 'neutral'"
              @click="toggleSlotDebug"
            >
              <SolarWidget2Bold class="control-plane-app__button-icon" aria-hidden="true" />
              <span>Slots</span>
            </UiButton>
          </div>
        </div>
      </div>
    </header>

    <main id="mainLayout" class="control-plane-app__page-layout">
      <SlotOutlet
        v-if="activePageContribution !== null"
        :content-id="activePageContribution.contentId"
        :context="pageContext"
        slot-id="control-plane.page"
        :tags="['control-plane.page']"
      >
        <div class="control-plane-app__empty-page">No page contribution is available.</div>
      </SlotOutlet>
      <div v-else class="control-plane-app__empty-page">No page contribution is available.</div>
    </main>
  </div>
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
  @apply flex min-w-0 flex-wrap items-center gap-3;
}

.control-plane-app__title {
  @apply truncate text-lg font-semibold tracking-normal;
}

.control-plane-app__toolbar {
  @apply flex flex-wrap items-center justify-end gap-3;
}

.control-plane-app__action-group {
  @apply flex flex-wrap items-center justify-end gap-2;
}

.control-plane-app__status-group {
  @apply flex flex-wrap items-center justify-end gap-1;
}

.control-plane-app__toggle-group {
  @apply flex flex-wrap items-center justify-end gap-2;
}

.control-plane-app__nav-group {
  @apply flex flex-wrap items-center justify-start gap-2;
}

.control-plane-app__page-button {
  @apply gap-1.5 px-2.5 text-xs;
}

.control-plane-app__slot-debug-button {
  @apply gap-1.5 px-2.5 text-xs;
}

.control-plane-app__button-icon {
  @apply h-3.5 w-3.5;
}

.control-plane-app__page-layout {
  @apply flex min-h-0 flex-1 overflow-hidden bg-zinc-100 p-4 pt-0;
}

.control-plane-app__empty-page {
  @apply flex min-h-0 flex-1 items-center justify-center bg-white p-8 text-sm text-zinc-500;
}
</style>
