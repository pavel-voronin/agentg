<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useControlPlaneHost } from '@agentg/control-plane-sdk/host';
import UiMetricTile from '@agentg/control-plane-sdk/ui/metric-tile';

type DashboardMetric = 'coverage' | 'currentJob' | 'targets';

type HistoryOverview = {
  activeJob: {
    chatId: string;
    endAt: string;
    startAt: string;
    status: string;
  } | null;
  coverageIntervals: number;
  pendingJobs: number;
  runningJobs: number;
  targets: number;
  templates: number;
};

const props = defineProps<{
  metric: DashboardMetric;
}>();

const host = useControlPlaneHost();
const overview = ref<HistoryOverview | null>(null);
let stopEvents: (() => void) | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

const tile = computed(() => dashboardMetric(props.metric, overview.value));

onMounted(() => {
  stopEvents = host.subscribeEvents((event) => {
    const type = event.type ?? '';
    if (type.startsWith('history.')) {
      scheduleRefresh();
    }
  });
  void refresh().catch(pushLocalError);
});

onBeforeUnmount(() => {
  stopEvents?.();
  stopEvents = null;
  clearRefreshTimer();
});

async function refresh(): Promise<void> {
  overview.value = normalizeHistoryOverview(await host.rpc('history.getOverview'));
}

function scheduleRefresh(): void {
  clearRefreshTimer();
  refreshTimer = setTimeout(() => {
    void refresh().catch(pushLocalError);
  }, 250);
}

function clearRefreshTimer(): void {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function dashboardMetric(
  metric: DashboardMetric,
  source: HistoryOverview | null
): { detail?: string; label: string; value: string } {
  if (metric === 'targets') {
    return {
      label: 'Targets',
      value: formatInteger(source?.targets ?? 0)
    };
  }
  if (metric === 'coverage') {
    return {
      label: 'Coverage intervals',
      value: formatInteger(source?.coverageIntervals ?? 0)
    };
  }

  const activeJob = source?.activeJob ?? null;
  return {
    detail: activeJob
      ? `${formatOptionalValue(activeJob.chatId)} - ${shortInterval(activeJob)}`
      : 'idle',
    label: 'Current job',
    value: activeJob?.status ?? '-'
  };
}

function shortInterval(interval: { endAt?: Date | string; startAt?: Date | string }): string {
  return `${shortDate(interval.startAt)} -> ${shortDate(interval.endAt)}`;
}

function shortDate(value: Date | string | undefined): string {
  const date = value instanceof Date ? value : new Date(value ?? '');
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(5, 16).replace('T', ' ');
}

function normalizeHistoryOverview(value: unknown): HistoryOverview {
  const input = asRecord(value);
  const activeJob = asRecord(input?.activeJob);
  return {
    activeJob:
      activeJob === undefined
        ? null
        : {
            chatId: asString(activeJob.chatId) ?? '',
            endAt: asString(activeJob.endAt) ?? '',
            startAt: asString(activeJob.startAt) ?? '',
            status: asString(activeJob.status) ?? ''
          },
    coverageIntervals: asNonNegativeInteger(input?.coverageIntervals),
    pendingJobs: asNonNegativeInteger(input?.pendingJobs),
    runningJobs: asNonNegativeInteger(input?.runningJobs),
    targets: asNonNegativeInteger(input?.targets),
    templates: asNonNegativeInteger(input?.templates)
  };
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}

function formatOptionalValue(value: Date | number | string | undefined): string {
  return value === undefined ? '' : String(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function pushLocalError(error: unknown): void {
  console.error(error);
}
</script>

<template>
  <UiMetricTile :detail="tile.detail" :label="tile.label" :value="tile.value" />
</template>
