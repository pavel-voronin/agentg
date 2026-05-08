<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useControlPlaneHost } from '@agentg/control-plane-sdk/host';
import UiMetricTile from '@agentg/control-plane-sdk/ui/metric-tile';

type ActiveJob = {
  chatId: string;
  endAt: string;
  id: string;
  startAt: string;
  status: 'pending' | 'running';
};

const host = useControlPlaneHost();
const activeJobs = ref<ActiveJob[]>([]);
let stopEvents: (() => void) | null = null;

const currentJob = computed(() => selectCurrentJob(activeJobs.value));
const tile = computed(() => dashboardMetric(currentJob.value));

onMounted(() => {
  stopEvents = host.subscribeEvents((event) => {
    applyJobEvent(event);
  });
});

onBeforeUnmount(() => {
  stopEvents?.();
  stopEvents = null;
});

function applyJobEvent(event: { data?: unknown; type?: string }): void {
  const type = event.type;
  if (type === 'history.job.created') {
    upsertActiveJob(event, 'pending');
    return;
  }
  if (type === 'history.job.started' || type === 'history.job.progress') {
    upsertActiveJob(event, 'running');
    return;
  }
  if (type === 'history.job.completed' || type === 'history.job.failed') {
    removeActiveJob(event);
  }
}

function upsertActiveJob(event: { data?: unknown }, status: ActiveJob['status']): void {
  const job = activeJobFromEvent(event, status);
  if (job === null) {
    return;
  }

  activeJobs.value = [...activeJobs.value.filter((item) => item.id !== job.id), job];
}

function removeActiveJob(event: { data?: unknown }): void {
  const jobId = eventJobId(event);
  if (jobId === undefined) {
    return;
  }
  activeJobs.value = activeJobs.value.filter((job) => job.id !== jobId);
}

function dashboardMetric(activeJob: ActiveJob | null): {
  detail?: string;
  label: string;
  value: string;
} {
  return {
    detail: activeJob ? `${activeJob.chatId} - ${shortInterval(activeJob)}` : 'idle',
    label: 'Current job',
    value: activeJob?.status ?? '-'
  };
}

function selectCurrentJob(jobs: ActiveJob[]): ActiveJob | null {
  return [...jobs].sort(compareActiveJobs)[0] ?? null;
}

function compareActiveJobs(left: ActiveJob, right: ActiveJob): number {
  const statusDelta = statusRank(right.status) - statusRank(left.status);
  if (statusDelta !== 0) {
    return statusDelta;
  }

  const endDelta = right.endAt.localeCompare(left.endAt);
  if (endDelta !== 0) {
    return endDelta;
  }

  const startDelta = right.startAt.localeCompare(left.startAt);
  if (startDelta !== 0) {
    return startDelta;
  }

  return right.id.localeCompare(left.id);
}

function statusRank(status: ActiveJob['status']): number {
  return status === 'running' ? 2 : 1;
}

function shortInterval(interval: { endAt?: Date | string; startAt?: Date | string }): string {
  return `${shortDate(interval.startAt)} -> ${shortDate(interval.endAt)}`;
}

function shortDate(value: Date | string | undefined): string {
  const date = value instanceof Date ? value : new Date(value ?? '');
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(5, 16).replace('T', ' ');
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function activeJobFromEvent(
  event: { data?: unknown },
  status: ActiveJob['status']
): ActiveJob | null {
  const data = asRecord(event.data);
  const id = asNonEmptyString(data?.jobId);
  const chatId = asNonEmptyString(data?.chatId);
  const endAt = asNonEmptyString(data?.jobEnd);
  const startAt = asNonEmptyString(data?.jobStart);
  if (id === undefined || chatId === undefined || endAt === undefined || startAt === undefined) {
    return null;
  }

  return {
    chatId,
    endAt,
    id,
    startAt,
    status
  };
}

function eventJobId(event: { data?: unknown }): string | undefined {
  return asNonEmptyString(asRecord(event.data)?.jobId);
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
</script>

<template>
  <UiMetricTile :detail="tile.detail" :label="tile.label" :value="tile.value" />
</template>
