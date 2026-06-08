<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  slotRoute,
  UiGrafanaDashboard,
  useControlPlaneHost,
  type SlotContext
} from '@agentg/framework/cp';
import SolarArrowRightUpBold from '~icons/solar/arrow-right-up-bold';

import { telemetryRouteSegments, telemetryTabFromSegment, type TelemetryTabId } from './route.js';
import { LINKS_METHOD, type LinkSet } from './contracts.js';

const props = defineProps<{
  slotContext?: SlotContext | undefined;
}>();

type TabView = {
  id: TelemetryTabId;
  label: string;
};

const tabs: TabView[] = [
  { id: 'operations', label: 'Operations' },
  { id: 'updates', label: 'Updates' },
  { id: 'nats', label: 'NATS' }
];

const host = useControlPlaneHost();
const route = computed(() => slotRoute(props.slotContext));
const activeTab = computed(() => telemetryTabFromSegment(route.value.segment(0)));
const links = ref<LinkSet | null>(null);
const error = ref<string | null>(null);

onMounted(() => {
  void loadLinks();
});

function selectTab(tabId: TelemetryTabId): void {
  route.value.replace(telemetryRouteSegments(tabId));
}

async function loadLinks(): Promise<void> {
  error.value = null;
  links.value = null;
  try {
    links.value = await host.rpc<LinkSet>(LINKS_METHOD);
  } catch (loadError) {
    error.value = errorMessage(loadError);
  }
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}
</script>

<template>
  <section class="telemetry-page">
    <header class="telemetry-page__header">
      <div class="telemetry-page__title-frame">
        <h2 class="telemetry-page__title">Telemetry</h2>
      </div>
      <div class="telemetry-page__actions">
        <a
          v-if="links"
          class="telemetry-page__link"
          :href="links.metricsUi"
          target="_blank"
          rel="noreferrer"
        >
          <SolarArrowRightUpBold class="telemetry-page__link-icon" aria-hidden="true" />
          <span class="telemetry-page__link-label">VictoriaMetrics</span>
        </a>
        <a
          v-if="links"
          class="telemetry-page__link"
          :href="links.grafanaUi"
          target="_blank"
          rel="noreferrer"
        >
          <SolarArrowRightUpBold class="telemetry-page__link-icon" aria-hidden="true" />
          <span class="telemetry-page__link-label">Grafana</span>
        </a>
        <a
          v-if="links"
          class="telemetry-page__link"
          :href="links.jaegerUi"
          target="_blank"
          rel="noreferrer"
        >
          <SolarArrowRightUpBold class="telemetry-page__link-icon" aria-hidden="true" />
          <span class="telemetry-page__link-label">Jaeger</span>
        </a>
      </div>
    </header>

    <nav class="telemetry-page__tabs" aria-label="Telemetry sections">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="telemetry-page__tab"
        :data-active="activeTab === tab.id"
        :aria-current="activeTab === tab.id ? 'page' : undefined"
        @click="selectTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <div v-if="error" class="telemetry-page__error">{{ error }}</div>

    <section v-if="activeTab === 'operations'" class="telemetry-page__section">
      <div class="telemetry-page__section-header">
        <h3 class="telemetry-page__section-title">Operations</h3>
      </div>
      <UiGrafanaDashboard
        v-if="links"
        :base-url="links.grafanaUi"
        dashboard-slug="agentg-operations"
        dashboard-uid="agentg-operations"
        from="now-3d"
        kiosk
        title="Operations"
      />
      <div v-else class="telemetry-page__empty">No Grafana link</div>
    </section>

    <section v-if="activeTab === 'updates'" class="telemetry-page__section">
      <div class="telemetry-page__section-header">
        <h3 class="telemetry-page__section-title">TDLib Updates</h3>
      </div>
      <UiGrafanaDashboard
        v-if="links"
        :base-url="links.grafanaUi"
        dashboard-slug="agentg-tdlib-updates"
        dashboard-uid="agentg-tdlib-updates"
        from="now-3d"
        kiosk
        title="TDLib Updates"
      />
      <div v-else class="telemetry-page__empty">No Grafana link</div>
    </section>

    <section v-if="activeTab === 'nats'" class="telemetry-page__section">
      <div class="telemetry-page__section-header">
        <h3 class="telemetry-page__section-title">NATS</h3>
      </div>
      <UiGrafanaDashboard
        v-if="links"
        :base-url="links.grafanaUi"
        dashboard-slug="agentg-nats"
        dashboard-uid="agentg-nats"
        from="now-3d"
        kiosk
        title="NATS"
      />
      <div v-else class="telemetry-page__empty">No Grafana link</div>
    </section>

    <section v-if="activeTab === null" class="telemetry-page__section">
      <div class="telemetry-page__empty">Unknown telemetry section</div>
    </section>
  </section>
</template>

<style scoped>
@reference "tailwindcss";

.telemetry-page {
  @apply min-h-0 w-full flex-1 overflow-auto bg-white p-5 text-zinc-950;
}

.telemetry-page__header {
  @apply flex items-start justify-between gap-4 border-b border-zinc-200 pb-4;
}

.telemetry-page__title-frame {
  @apply min-w-0;
}

.telemetry-page__title {
  @apply text-xl font-semibold tracking-normal;
}

.telemetry-page__actions {
  @apply flex shrink-0 flex-wrap items-center justify-end gap-2;
}

.telemetry-page__link {
  @apply inline-flex h-8 items-center gap-1 rounded border border-zinc-200 px-2 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-950;
}

.telemetry-page__link-icon {
  @apply size-4 shrink-0;
}

.telemetry-page__link-label {
  @apply whitespace-nowrap;
}

.telemetry-page__tabs {
  @apply mt-4 flex flex-wrap gap-2;
}

.telemetry-page__tab {
  @apply rounded border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-950;
}

.telemetry-page__tab[data-active='true'] {
  @apply border-zinc-950 bg-zinc-950 text-white;
}

.telemetry-page__error {
  @apply mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700;
}

.telemetry-page__section {
  @apply mt-4 min-w-0;
}

.telemetry-page__section-header {
  @apply mt-4 flex items-center justify-between gap-3 border-b border-zinc-200 pb-2;
}

.telemetry-page__section-title {
  @apply text-sm font-semibold tracking-normal;
}

.telemetry-page__empty {
  @apply mt-3 rounded border border-dashed border-zinc-200 p-4 text-sm text-zinc-500;
}
</style>
