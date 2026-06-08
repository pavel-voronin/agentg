<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { slotRoute, UiGrafanaDashboard, type SlotContext } from '@agentg/framework/cp';

import { telemetryRouteSegments, telemetryTabFromSegment, type TelemetryTabId } from './route.js';
import { useLinks } from './links.js';

const props = defineProps<{
  slotContext?: SlotContext | undefined;
}>();

type TabView = {
  id: TelemetryTabId;
  label: string;
};

const tabs: TabView[] = [
  { id: 'operations', label: 'Operations' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'history-sync', label: 'History Sync' },
  { id: 'updates', label: 'Updates' },
  { id: 'postgres', label: 'Postgres' },
  { id: 'nats', label: 'NATS' }
];

const route = computed(() => slotRoute(props.slotContext));
const activeTab = computed(() => telemetryTabFromSegment(route.value.segment(0)));
const { links, error, loadLinks } = useLinks();

onMounted(() => {
  void loadLinks();
});

function selectTab(tabId: TelemetryTabId): void {
  route.value.replace(telemetryRouteSegments(tabId));
}
</script>

<template>
  <section class="telemetry-page">
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
      <UiGrafanaDashboard
        v-if="links"
        :base-url="links.grafanaUi"
        dashboard-slug="agentg-operations"
        dashboard-uid="agentg-operations"
        kiosk
        title="Operations"
      />
      <div v-else class="telemetry-page__empty">No Grafana link</div>
    </section>

    <section v-if="activeTab === 'telegram'" class="telemetry-page__section">
      <UiGrafanaDashboard
        v-if="links"
        :base-url="links.grafanaUi"
        dashboard-slug="agentg-telegram"
        dashboard-uid="agentg-telegram"
        kiosk
        title="Telegram"
      />
      <div v-else class="telemetry-page__empty">No Grafana link</div>
    </section>

    <section v-if="activeTab === 'history-sync'" class="telemetry-page__section">
      <UiGrafanaDashboard
        v-if="links"
        :base-url="links.grafanaUi"
        dashboard-slug="agentg-history-sync"
        dashboard-uid="agentg-history-sync"
        kiosk
        title="History Sync"
      />
      <div v-else class="telemetry-page__empty">No Grafana link</div>
    </section>

    <section v-if="activeTab === 'updates'" class="telemetry-page__section">
      <UiGrafanaDashboard
        v-if="links"
        :base-url="links.grafanaUi"
        dashboard-slug="agentg-tdlib-updates"
        dashboard-uid="agentg-tdlib-updates"
        kiosk
        title="TDLib Updates"
      />
      <div v-else class="telemetry-page__empty">No Grafana link</div>
    </section>

    <section v-if="activeTab === 'nats'" class="telemetry-page__section">
      <UiGrafanaDashboard
        v-if="links"
        :base-url="links.grafanaUi"
        dashboard-slug="agentg-nats"
        dashboard-uid="agentg-nats"
        kiosk
        title="NATS"
      />
      <div v-else class="telemetry-page__empty">No Grafana link</div>
    </section>

    <section v-if="activeTab === 'postgres'" class="telemetry-page__section">
      <UiGrafanaDashboard
        v-if="links"
        :base-url="links.grafanaUi"
        dashboard-slug="agentg-postgres"
        dashboard-uid="agentg-postgres"
        kiosk
        title="Postgres"
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

.telemetry-page__tabs {
  @apply flex flex-wrap gap-2;
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

.telemetry-page__empty {
  @apply mt-3 rounded border border-dashed border-zinc-200 p-4 text-sm text-zinc-500;
}
</style>
