import { onBeforeUnmount, onMounted, readonly, ref } from 'vue';

import { useControlPlaneHost, type ControlPlaneHostEvent } from '@agentg/control-plane-sdk/host';

import type { ChatStats } from './views.js';

type JobStatus = 'pending' | 'running';

type DatedInterval = {
  endAt: Date;
  startAt: Date;
};

const coverageByChat = new Map<string, DatedInterval[]>();
const jobsByChat = new Map<string, Map<string, JobStatus>>();
const statsByChat = ref(new Map<string, ChatStats>());
const targetsByChat = new Map<string, Set<string>>();

let subscribers = 0;
let stopEvents: (() => void) | null = null;

export function useTelegramHistoryStatsProjection() {
  const host = useControlPlaneHost();

  onMounted(() => {
    subscribers += 1;
    stopEvents ??= host.subscribeEvents(applyHistoryStatsEvent);
  });

  onBeforeUnmount(() => {
    subscribers -= 1;
    if (subscribers <= 0) {
      subscribers = 0;
      stopEvents?.();
      stopEvents = null;
    }
  });

  return {
    statsByChat: readonly(statsByChat)
  };
}

function applyHistoryStatsEvent(event: ControlPlaneHostEvent): void {
  const type = event.type;
  if (type === 'history.coverage.changed') {
    applyCoverageChanged(event);
    return;
  }
  if (type === 'history.target.upserted') {
    applyTargetUpserted(event);
    return;
  }
  if (type === 'history.target.deleted' || type === 'history.target.auto_deleted') {
    applyTargetDeleted(event);
    return;
  }
  if (type === 'history.job.created') {
    applyJobEvent(event, 'pending');
    return;
  }
  if (type === 'history.job.started' || type === 'history.job.progress') {
    applyJobEvent(event, 'running');
    return;
  }
  if (type === 'history.job.failed') {
    applyJobEvent(event, 'pending');
    return;
  }
  if (type === 'history.job.completed') {
    applyJobCompleted(event);
  }
}

function applyCoverageChanged(event: ControlPlaneHostEvent): void {
  for (const interval of coverageIntervalsFromEvent(event)) {
    const existing = coverageByChat.get(interval.chatId) ?? [];
    coverageByChat.set(
      interval.chatId,
      mergeIntervals([...existing, { endAt: interval.endAt, startAt: interval.startAt }])
    );
    publishChatStats(interval.chatId);
  }
}

function applyTargetUpserted(event: ControlPlaneHostEvent): void {
  const target = asRecord(asRecord(event.data)?.target);
  const chatId = asString(target?.chatId);
  const targetId = asString(target?.id);
  if (chatId === undefined || targetId === undefined) {
    return;
  }

  const targets = targetsByChat.get(chatId) ?? new Set<string>();
  targets.add(targetId);
  targetsByChat.set(chatId, targets);
  publishChatStats(chatId);
}

function applyTargetDeleted(event: ControlPlaneHostEvent): void {
  const data = asRecord(event.data);
  const target = asRecord(data?.target);
  const chatId = asString(target?.chatId) ?? asString(data?.chatId);
  const targetId = asString(target?.id) ?? asString(data?.targetId);
  if (chatId === undefined || targetId === undefined) {
    return;
  }

  targetsByChat.get(chatId)?.delete(targetId);
  publishChatStats(chatId);
}

function applyJobEvent(event: ControlPlaneHostEvent, status: JobStatus): void {
  const job = jobFromEvent(event);
  if (job === null) {
    return;
  }

  const jobs = jobsByChat.get(job.chatId) ?? new Map<string, JobStatus>();
  jobs.set(job.jobId, status);
  jobsByChat.set(job.chatId, jobs);
  publishChatStats(job.chatId);
}

function applyJobCompleted(event: ControlPlaneHostEvent): void {
  const job = jobFromEvent(event);
  if (job === null) {
    return;
  }

  jobsByChat.get(job.chatId)?.delete(job.jobId);
  publishChatStats(job.chatId);
}

function publishChatStats(chatId: string): void {
  const coverage = coverageByChat.get(chatId) ?? [];
  const jobs = jobsByChat.get(chatId) ?? new Map<string, JobStatus>();
  let pendingJobs = 0;
  let runningJobs = 0;

  for (const status of jobs.values()) {
    if (status === 'pending') {
      pendingJobs += 1;
    } else {
      runningJobs += 1;
    }
  }

  statsByChat.value = new Map(statsByChat.value).set(chatId, {
    chatId,
    coverageIntervals: coverage.length,
    coverageNewestAt: maxDate(coverage.map((interval) => interval.endAt)),
    coverageOldestAt: minDate(coverage.map((interval) => interval.startAt)),
    pendingJobs,
    runningJobs,
    targets: targetsByChat.get(chatId)?.size ?? 0
  });
}

function coverageIntervalsFromEvent(event: ControlPlaneHostEvent): (DatedInterval & {
  chatId: string;
})[] {
  return asRecords(asRecord(event.data)?.intervals).flatMap((interval) => {
    const chatId = asString(interval.chatId);
    const startAt = parseDate(asString(interval.startAt));
    const endAt = parseDate(asString(interval.endAt));
    if (chatId === undefined || startAt === undefined || endAt === undefined || startAt >= endAt) {
      return [];
    }
    return [{ chatId, endAt, startAt }];
  });
}

function jobFromEvent(event: ControlPlaneHostEvent): { chatId: string; jobId: string } | null {
  const data = asRecord(event.data);
  const chatId = asString(data?.chatId);
  const jobId = asString(data?.jobId);
  if (chatId === undefined || jobId === undefined) {
    return null;
  }
  return { chatId, jobId };
}

function mergeIntervals(intervals: DatedInterval[]): DatedInterval[] {
  const sorted = intervals
    .filter((interval) => interval.startAt < interval.endAt)
    .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());
  const merged: DatedInterval[] = [];

  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (previous === undefined || interval.startAt > previous.endAt) {
      merged.push({ ...interval });
      continue;
    }
    if (interval.endAt > previous.endAt) {
      previous.endAt = interval.endAt;
    }
  }

  return merged;
}

function minDate(values: Date[]): string | null {
  const first = values[0];
  if (first === undefined) {
    return null;
  }
  return values
    .reduce((minimum, value) => (value < minimum ? value : minimum), first)
    .toISOString();
}

function maxDate(values: Date[]): string | null {
  const first = values[0];
  if (first === undefined) {
    return null;
  }
  return values
    .reduce((maximum, value) => (value > maximum ? value : maximum), first)
    .toISOString();
}

function parseDate(value: string | undefined): Date | undefined {
  if (value === undefined) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => asRecord(item) !== undefined)
    : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
