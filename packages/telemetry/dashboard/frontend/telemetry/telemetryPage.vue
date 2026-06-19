<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  slotRoute,
  UiGrafanaDashboard,
  UiPage,
  type SlotContext
} from '@agentg/framework/dashboard';

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
  { id: 'overview', label: 'Overview' },
  { id: 'policies', label: 'Policies' },
  { id: 'triggers', label: 'Triggers' },
  { id: 'llm-runner', label: 'LLM Runner' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'get-messages', label: 'Get Messages' },
  { id: 'history-reconciler', label: 'History Reconciler' },
  { id: 'files', label: 'Files' },
  { id: 'updates', label: 'Updates' },
  { id: 'postgres', label: 'Postgres' },
  { id: 'nats', label: 'NATS' }
];

const route = computed(() => slotRoute(props.slotContext));
const activeTab = computed(() => telemetryTabFromSegment(route.value.segment(0)));
const { links, error, loadLinks } = useLinks();
const reloadVersion = ref(0);
const activeViewKey = computed(() => `${activeTab.value ?? 'unknown'}:${reloadVersion.value}`);

watch(
  activeTab,
  (tab) => {
    if (tab !== null && tab !== 'overview') {
      void loadLinks();
    }
  },
  { immediate: true }
);

function selectTab(tabId: TelemetryTabId): void {
  if (activeTab.value === tabId) {
    reloadVersion.value += 1;
    if (tabId !== 'overview') {
      void loadLinks();
    }
    return;
  }

  route.value.replace(telemetryRouteSegments(tabId));
}
</script>

<template>
  <UiPage>
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

    <section v-if="activeTab === 'overview'" class="telemetry-page__section"></section>

    <section v-if="activeTab === 'policies'" class="telemetry-page__section">
      <UiGrafanaDashboard
        v-if="links"
        :key="activeViewKey"
        :base-url="links.grafanaUi"
        dashboard-slug="agentg-policies"
        dashboard-uid="agentg-policies"
        kiosk
        title="Policies"
      />
      <div v-else class="telemetry-page__empty">No Grafana link</div>
    </section>

    <section v-if="activeTab === 'triggers'" class="telemetry-page__section">
      <UiGrafanaDashboard
        v-if="links"
        :key="activeViewKey"
        :base-url="links.grafanaUi"
        dashboard-slug="agentg-triggers"
        dashboard-uid="agentg-triggers"
        kiosk
        title="Triggers"
      />
      <div v-else class="telemetry-page__empty">No Grafana link</div>
    </section>

    <section v-if="activeTab === 'llm-runner'" class="telemetry-page__section">
      <UiGrafanaDashboard
        v-if="links"
        :key="activeViewKey"
        :base-url="links.grafanaUi"
        dashboard-slug="agentg-llm-runner"
        dashboard-uid="agentg-llm-runner"
        kiosk
        title="LLM Runner"
      />
      <div v-else class="telemetry-page__empty">No Grafana link</div>
    </section>

    <section v-if="activeTab === 'telegram'" class="telemetry-page__section">
      <UiGrafanaDashboard
        v-if="links"
        :key="activeViewKey"
        :base-url="links.grafanaUi"
        dashboard-slug="agentg-telegram"
        dashboard-uid="agentg-telegram"
        kiosk
        title="Telegram"
      />
      <div v-else class="telemetry-page__empty">No Grafana link</div>
    </section>

    <section v-if="activeTab === 'get-messages'" class="telemetry-page__section">
      <UiGrafanaDashboard
        v-if="links"
        :key="activeViewKey"
        :base-url="links.grafanaUi"
        dashboard-slug="telegram-get-messages"
        dashboard-uid="telegram-get-messages"
        kiosk
        title="Get Messages"
      />
      <div v-else class="telemetry-page__empty">No Grafana link</div>
    </section>

    <section v-if="activeTab === 'history-reconciler'" class="telemetry-page__section">
      <UiGrafanaDashboard
        v-if="links"
        :key="activeViewKey"
        :base-url="links.grafanaUi"
        dashboard-slug="telegram-history-reconciler"
        dashboard-uid="telegram-history-reconciler"
        kiosk
        title="History Reconciler"
      />
      <div v-else class="telemetry-page__empty">No Grafana link</div>
    </section>

    <section v-if="activeTab === 'files'" class="telemetry-page__section">
      <UiGrafanaDashboard
        v-if="links"
        :key="activeViewKey"
        :base-url="links.grafanaUi"
        dashboard-slug="agentg-files"
        dashboard-uid="agentg-files"
        kiosk
        title="Files"
      />
      <div v-else class="telemetry-page__empty">No Grafana link</div>
    </section>

    <section v-if="activeTab === 'updates'" class="telemetry-page__section">
      <UiGrafanaDashboard
        v-if="links"
        :key="activeViewKey"
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
        :key="activeViewKey"
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
        :key="activeViewKey"
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
  </UiPage>
</template>

<style scoped>
@reference "tailwindcss";

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
