<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  SlotOutlet,
  slotRoute,
  useControlPlaneHost,
  useSlotRuntime,
  type ControlPlaneHostEvent,
  type SlotContext
} from '@agentg/framework/cp';
import SolarSettingsBold from '~icons/solar/settings-bold';

import DatabaseTab from './database/databaseTab.vue';
import ErrorsTab from './errors/errorsTab.vue';
import NatsTelemetryPage from './nats/natsTab.vue';
import OverviewPanel from './overview/overviewTab.vue';
import RpcTab from './rpc/rpcTab.vue';
import SlowestTab from './slowest/slowestTab.vue';
import SourceIndicators from './status/sourceIndicators.vue';
import TelemetrySettings from './settings/settingsPanel.vue';
import TelemetryTabNav from './navigation/tabNav.vue';
import UpdateTab from './update/updateTab.vue';
import { NATS_REPORT_EVENT_TYPE, REPORT_EVENT_TYPE, TAB_SLOT_ID } from './contracts.js';
import { useTelemetryMetricSections } from './report/metricSections.js';
import { useNatsTelemetryReport } from './nats/useNatsReport.js';
import { useTelemetryReport } from './report/useReport.js';
import { useTelemetryStatusSources } from './status/useStatusSources.js';
import { useTelemetryTabs } from './navigation/tabs.js';

const props = defineProps<{
  slotContext?: SlotContext | undefined;
}>();

const host = useControlPlaneHost();
const slotRuntime = useSlotRuntime();
const settingsOpen = ref(false);
const route = computed(() => slotRoute(props.slotContext));
const {
  activeExternalTab,
  activeExternalTabSlotTag,
  activeMetricPanel,
  activeTab,
  activeTabRoute,
  externalTabs,
  reportTabs,
  selectMetricPanel,
  selectTab
} = useTelemetryTabs({ route, slotRuntime });
const {
  markEventSourceAccepted,
  markSourceAccepted,
  markSourceError,
  sourceIndicators,
  statusSources
} = useTelemetryStatusSources(externalTabs);
const {
  acceptReport,
  applyReportWindow,
  cancelReset,
  changeMetricSort,
  error,
  loadReport,
  loading,
  recordLimitInput,
  reportSorts,
  requestMode,
  requestReset,
  resetConfirmOpen,
  resetReport,
  useLiveReport,
  view
} = useTelemetryReport(host, { markSourceAccepted, markSourceError });
const { acceptNatsReport, ensureNatsReport, natsError, natsLoading, natsReport } =
  useNatsTelemetryReport(host, { markSourceAccepted, markSourceError });
const { activeMetricSection, activeSlowestRows, activeSlowestTitle } = useTelemetryMetricSections({
  activeTab,
  view
});
let unsubscribeEvents: (() => void) | null = null;

onMounted(() => {
  unsubscribeEvents = host.subscribeEvents(receiveEvent);
  void loadReport();
});

onBeforeUnmount(() => {
  unsubscribeEvents?.();
  unsubscribeEvents = null;
});

watch(
  activeTab,
  (tabId) => {
    if (tabId === 'nats') {
      void ensureNatsReport();
    }
  },
  { immediate: true }
);

function receiveEvent(event: ControlPlaneHostEvent): void {
  const source = statusSources.value.find((candidate) => candidate.eventType === event.type);
  if (event.type === REPORT_EVENT_TYPE) {
    markEventSourceAccepted(source);
    if (requestMode.value !== 'live') {
      return;
    }
    try {
      acceptReport(event.data);
    } catch (reportError) {
      const message = errorMessage(reportError);
      error.value = message;
      markSourceError('telemetry.report', message);
    }
    return;
  }
  if (event.type === NATS_REPORT_EVENT_TYPE) {
    markEventSourceAccepted(source);
    try {
      acceptNatsReport(event.data);
    } catch (reportError) {
      const message = errorMessage(reportError);
      natsError.value = message;
      markSourceError('telemetry.nats', message);
    }
    return;
  }
  if (source !== undefined) {
    markEventSourceAccepted(source);
  }
}

function toggleSettings(): void {
  settingsOpen.value = !settingsOpen.value;
  if (!settingsOpen.value) {
    resetConfirmOpen.value = false;
  }
}

function errorMessage(errorValue: unknown): string {
  return errorValue instanceof Error ? errorValue.message : String(errorValue);
}
</script>

<template>
  <section class="telemetry-page">
    <header class="telemetry-page__header">
      <div class="telemetry-page__title-frame">
        <h2 class="telemetry-page__title">Telemetry</h2>
      </div>
      <div class="telemetry-page__header-actions">
        <SourceIndicators :sources="sourceIndicators" />
        <button
          type="button"
          class="telemetry-page__action"
          :aria-expanded="settingsOpen"
          title="Telemetry settings"
          @click="toggleSettings"
        >
          <SolarSettingsBold class="telemetry-page__action-icon" aria-hidden="true" />
          <span class="telemetry-page__action-label">Settings</span>
        </button>
      </div>
    </header>

    <div v-if="error" class="telemetry-page__error">{{ error }}</div>

    <TelemetrySettings
      v-if="settingsOpen"
      v-model:record-limit-input="recordLimitInput"
      :loading="loading"
      :max-report-record-limit="view.maxReportRecordLimit"
      :request-mode="requestMode"
      :reset-confirm-open="resetConfirmOpen"
      :storage-footprint="view.storageFootprint"
      @apply="applyReportWindow"
      @cancel-reset="cancelReset"
      @confirm-reset="resetReport"
      @live="useLiveReport"
      @request-reset="requestReset"
    />

    <TelemetryTabNav
      :active-id="activeTab"
      navigation-label="Telemetry report sections"
      :tabs="reportTabs"
      variant="main"
      @select="selectTab"
    />

    <OverviewPanel v-if="activeTab === 'overview'" :view="view" />

    <NatsTelemetryPage
      v-if="activeTab === 'nats'"
      :error="natsError"
      :loading="natsLoading"
      :report="natsReport"
    />
    <SlotOutlet
      v-if="activeExternalTabSlotTag.length > 0"
      :context="activeTabRoute.context"
      :slot-id="TAB_SLOT_ID"
      :tags="[activeExternalTabSlotTag]"
    />

    <UpdateTab
      v-if="activeTab === 'update' && activeMetricSection"
      :active-panel="activeMetricPanel"
      :dropped-records="view.droppedRecords"
      :ignored-records="view.ignoredRecords"
      :sample-rows="activeSlowestRows"
      :sample-title="activeSlowestTitle"
      :section="activeMetricSection"
      :sort="reportSorts[activeMetricSection.id]"
      @change-sort="changeMetricSort"
      @select-panel="selectMetricPanel"
    />

    <DatabaseTab
      v-if="activeTab === 'database' && activeMetricSection"
      :active-panel="activeMetricPanel"
      :dropped-records="view.droppedRecords"
      :ignored-records="view.ignoredRecords"
      :sample-rows="activeSlowestRows"
      :sample-title="activeSlowestTitle"
      :section="activeMetricSection"
      :sort="reportSorts[activeMetricSection.id]"
      @change-sort="changeMetricSort"
      @select-panel="selectMetricPanel"
    />

    <RpcTab
      v-if="activeTab === 'rpc' && activeMetricSection"
      :active-panel="activeMetricPanel"
      :dropped-records="view.droppedRecords"
      :ignored-records="view.ignoredRecords"
      :sample-rows="activeSlowestRows"
      :sample-title="activeSlowestTitle"
      :section="activeMetricSection"
      :sort="reportSorts[activeMetricSection.id]"
      @change-sort="changeMetricSort"
      @select-panel="selectMetricPanel"
    />

    <ErrorsTab
      v-if="activeTab === 'errors'"
      :dropped-records="view.droppedRecords"
      :ignored-records="view.ignoredRecords"
      :rows="activeSlowestRows"
      :title="activeSlowestTitle"
    />

    <SlowestTab
      v-if="activeTab === 'slowest'"
      :dropped-records="view.droppedRecords"
      :ignored-records="view.ignoredRecords"
      :rows="activeSlowestRows"
      :title="activeSlowestTitle"
    />
  </section>
</template>

<style scoped>
@reference "tailwindcss";

.telemetry-page {
  @apply min-h-0 w-full flex-1 overflow-auto bg-white p-5;
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

.telemetry-page__header-actions {
  @apply flex shrink-0 items-center gap-2;
}

.telemetry-page__action {
  @apply inline-flex h-8 items-center gap-1 rounded border border-zinc-200 px-2 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-950 disabled:cursor-wait disabled:opacity-60;
}

.telemetry-page__action-icon {
  @apply size-4 shrink-0;
}

.telemetry-page__action-label {
  @apply whitespace-nowrap;
}

.telemetry-page__error {
  @apply mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700;
}
</style>
