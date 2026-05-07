import type {
  ControlPlaneEvent,
  HistoryBoundary,
  HistoryInterval,
  HistoryJob,
  HistoryRange,
  HistoryTarget,
  SelectedHistoryState
} from './views.js';

type DatedInterval = {
  endAt: Date;
  messageCount?: number;
  startAt: Date;
};

type TimelineJobEvent = {
  chatId: string;
  job: HistoryJob;
};

const TELEGRAM_HISTORY_TICK_MS = 1000;

export function applyHistoryTimelineEvent(
  state: SelectedHistoryState,
  event: ControlPlaneEvent
): boolean {
  const type = event.type;
  if (type === 'history.coverage.changed') {
    return applyCoverageChanged(state, event);
  }
  if (type === 'history.target.upserted') {
    return applyTargetUpserted(state, event);
  }
  if (type === 'history.target.deleted' || type === 'history.target.auto_deleted') {
    return applyTargetDeleted(state, event);
  }
  if (type === 'history.job.created') {
    return applyJobCreated(state, event);
  }
  if (type === 'history.job.started' || type === 'history.job.progress') {
    return applyJobRunning(state, event);
  }
  if (type === 'history.job.completed') {
    return applyJobCompleted(state, event);
  }
  if (type === 'history.job.failed') {
    return applyJobFailed(state, event);
  }
  return false;
}

function applyCoverageChanged(state: SelectedHistoryState, event: ControlPlaneEvent): boolean {
  const chatId = selectedChatId(state);
  if (chatId === null) {
    return false;
  }

  const intervals = coverageEventIntervals(event).filter((interval) => interval.chatId === chatId);
  if (intervals.length === 0) {
    return false;
  }

  state.coverage = mergeCoverageIntervals([
    ...state.coverage,
    ...intervals.map((interval) => ({
      endAt: interval.endAt,
      ...(interval.messageCount === undefined ? {} : { messageCount: interval.messageCount }),
      startAt: interval.startAt
    }))
  ]);
  recomputeTimelineCoverage(state);
  return true;
}

function applyTargetUpserted(state: SelectedHistoryState, event: ControlPlaneEvent): boolean {
  const target = historyTargetFromEvent(event);
  if (target === null) {
    return false;
  }
  if (target.chatId !== selectedChatId(state)) {
    return false;
  }

  state.targets = [...state.targets.filter((existing) => existing.id !== target.id), target].sort(
    compareTargets
  );
  recomputeTimelineCoverage(state);
  return true;
}

function applyTargetDeleted(state: SelectedHistoryState, event: ControlPlaneEvent): boolean {
  const chatId = selectedChatId(state);
  if (chatId === null) {
    return false;
  }

  const data = asRecord(event.data);
  const eventChatId = asString(asRecord(data?.target)?.chatId) ?? asString(data?.chatId);
  if (eventChatId !== undefined && eventChatId !== chatId) {
    return false;
  }

  const targetId = asString(asRecord(data?.target)?.id) ?? asString(data?.targetId);
  if (targetId === undefined || !state.targets.some((target) => target.id === targetId)) {
    return false;
  }

  state.targets = state.targets.filter((target) => target.id !== targetId);
  recomputeTimelineCoverage(state);
  return true;
}

function applyJobRunning(state: SelectedHistoryState, event: ControlPlaneEvent): boolean {
  const jobEvent = historyJobFromEvent(event, 'running');
  if (jobEvent === null) {
    return false;
  }
  if (jobEvent.chatId !== selectedChatId(state)) {
    return false;
  }

  state.jobs = upsertJob(state.jobs, jobEvent.job);
  return true;
}

function applyJobCreated(state: SelectedHistoryState, event: ControlPlaneEvent): boolean {
  const jobEvent = historyJobFromEvent(event, 'pending');
  if (jobEvent === null) {
    return false;
  }
  if (jobEvent.chatId !== selectedChatId(state)) {
    return false;
  }

  state.jobs = upsertJob(state.jobs, jobEvent.job);
  return true;
}

function applyJobCompleted(state: SelectedHistoryState, event: ControlPlaneEvent): boolean {
  const jobEvent = historyJobFromEvent(event, 'running');
  if (jobEvent === null) {
    return false;
  }
  if (jobEvent.chatId !== selectedChatId(state)) {
    return false;
  }

  const data = asRecord(event.data);
  const before = state.jobs.length;
  const countChanged = applyCompletedJobCoverageCount(state, jobEvent.job, event);
  state.jobs = state.jobs.filter((job) => job.id !== jobEvent.job.id);
  const beginningChanged = applyHistoryBeginningReached(state, data);
  return countChanged || state.jobs.length !== before || beginningChanged;
}

function applyJobFailed(state: SelectedHistoryState, event: ControlPlaneEvent): boolean {
  const jobEvent = historyJobFromEvent(event, 'pending');
  if (jobEvent === null) {
    return false;
  }
  if (jobEvent.chatId !== selectedChatId(state)) {
    return false;
  }

  const existing = state.jobs.find((job) => job.id === jobEvent.job.id);
  state.jobs = upsertJob(state.jobs, {
    ...(existing ?? jobEvent.job),
    status: 'pending',
    updatedAt: jobEvent.job.updatedAt
  });
  return true;
}

function recomputeTimelineCoverage(state: SelectedHistoryState): void {
  const displayStartAt = displayStartDate(state);
  const coverage = clipIntervalsForDisplay(mergeCoverageIntervals(state.coverage), displayStartAt);
  const desired = clipIntervalsForDisplay(
    mergeIntervals(state.targets.flatMap((target) => intervalFromTarget(target))),
    displayStartAt
  );

  state.coverage = coverage;
  state.desired = desired;
  state.missing = subtractIntervals(desired, coverage);
}

function applyCompletedJobCoverageCount(
  state: SelectedHistoryState,
  job: HistoryJob,
  event: ControlPlaneEvent
): boolean {
  const messageCount = nonNegativeInteger(asRecord(event.data)?.storedMessages);
  if (messageCount === undefined) {
    return false;
  }

  let changed = false;
  state.coverage = state.coverage.map((interval) => {
    if (!containsInterval(interval, job)) {
      return interval;
    }
    const nextMessageCount = sameInterval(interval, job)
      ? messageCount
      : (interval.messageCount ?? 0) + messageCount;
    if (interval.messageCount === nextMessageCount) {
      return interval;
    }
    changed = true;
    return {
      ...interval,
      messageCount: nextMessageCount
    };
  });
  return changed;
}

function applyHistoryBeginningReached(
  state: SelectedHistoryState,
  data: Record<string, unknown> | undefined
): boolean {
  if (data?.reachedBeginning !== true || state.chat === null) {
    return false;
  }

  let changed = false;
  if (!state.chat.historyBeginningReached) {
    state.chat.historyBeginningReached = true;
    changed = true;
  }

  const historyStartAt = normalizedDateString(data.historyStartAt);
  if (
    historyStartAt !== undefined &&
    shouldReplaceHistoryStart(state.chat.historyStartAt, historyStartAt)
  ) {
    state.chat.historyStartAt = historyStartAt;
    recomputeTimelineCoverage(state);
    changed = true;
  }

  return changed;
}

function shouldReplaceHistoryStart(current: string | null, next: string): boolean {
  if (current === null) {
    return true;
  }
  const currentTime = Date.parse(current);
  const nextTime = Date.parse(next);
  return !Number.isFinite(currentTime) || (Number.isFinite(nextTime) && nextTime < currentTime);
}

function coverageEventIntervals(event: ControlPlaneEvent): (HistoryInterval & {
  chatId: string;
})[] {
  const data = asRecord(event.data);
  return asRecords(data?.intervals).flatMap((interval) => {
    const chatId = asString(interval.chatId);
    const normalized = normalizeHistoryInterval(interval);
    return chatId === undefined || normalized === null ? [] : [{ ...normalized, chatId }];
  });
}

function historyTargetFromEvent(event: ControlPlaneEvent): HistoryTarget | null {
  const target = asRecord(asRecord(event.data)?.target);
  const chatId = asString(target?.chatId);
  const id = asString(target?.id);
  const projected = normalizeHistoryInterval(asRecord(target?.projected));
  const range = normalizeHistoryRange(asRecord(target?.range));

  if (chatId === undefined || id === undefined || projected === null || range === null) {
    return null;
  }

  const templateId = target?.templateId === null ? null : asString(target?.templateId);
  return {
    chatId,
    id,
    projected,
    range,
    ...(templateId === undefined ? {} : { templateId })
  };
}

function historyJobFromEvent(
  event: ControlPlaneEvent,
  status: 'pending' | 'running'
): TimelineJobEvent | null {
  const data = asRecord(event.data);
  const chatId = asString(data?.chatId);
  const id = asString(data?.jobId);
  const startAt = asString(data?.jobStart);
  const endAt = asString(data?.jobEnd);

  if (
    chatId === undefined ||
    id === undefined ||
    startAt === undefined ||
    endAt === undefined ||
    !isValidInterval(startAt, endAt)
  ) {
    return null;
  }

  const cursorMessageId = data?.cursorMessageId;
  return {
    chatId,
    job: {
      ...(typeof cursorMessageId === 'number' && Number.isSafeInteger(cursorMessageId)
        ? { cursor: { messageId: cursorMessageId } }
        : {}),
      endAt,
      id,
      startAt,
      status,
      telegramChatId: chatId,
      updatedAt: eventOccurredAt(event)
    }
  };
}

function normalizeHistoryInterval(
  value: Record<string, unknown> | undefined
): HistoryInterval | null {
  const startAt = asString(value?.startAt);
  const endAt = asString(value?.endAt);
  if (startAt === undefined || endAt === undefined || !isValidInterval(startAt, endAt)) {
    return null;
  }

  const messageCount = value?.messageCount;
  return {
    endAt,
    ...(typeof messageCount === 'number' && Number.isSafeInteger(messageCount) && messageCount >= 0
      ? { messageCount }
      : {}),
    startAt
  };
}

function normalizeHistoryRange(value: Record<string, unknown> | undefined): HistoryRange | null {
  const start = normalizeHistoryBoundary(asRecord(value?.start));
  const end = normalizeHistoryBoundary(asRecord(value?.end));
  return start === null || end === null ? null : { end, start };
}

function normalizeHistoryBoundary(
  value: Record<string, unknown> | undefined
): HistoryBoundary | null {
  if (value?.kind === 'absolute') {
    const at = asString(value.at);
    return at === undefined ? null : { at, kind: 'absolute' };
  }
  if (value?.kind === 'expression') {
    const expression = asString(value.expression);
    return expression === undefined ? null : { expression, kind: 'expression' };
  }
  return null;
}

function intervalFromTarget(target: HistoryTarget): HistoryInterval[] {
  return target.projected === undefined ? [] : [target.projected];
}

function mergeCoverageIntervals(intervals: HistoryInterval[]): HistoryInterval[] {
  const sorted = intervals
    .map((interval) => datedInterval(interval))
    .filter(isDatedInterval)
    .filter((interval) => interval.startAt < interval.endAt)
    .sort(compareIntervals);

  const merged: DatedInterval[] = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (
      previous === undefined ||
      interval.startAt.getTime() > previous.endAt.getTime() + TELEGRAM_HISTORY_TICK_MS
    ) {
      merged.push({ ...interval });
      continue;
    }
    if (interval.endAt > previous.endAt) {
      previous.endAt = interval.endAt;
    }
    setMergedMessageCount(previous, interval.messageCount);
  }

  return merged.map(intervalToState);
}

function mergeIntervals(intervals: HistoryInterval[]): HistoryInterval[] {
  const sorted = intervals
    .map((interval) => datedInterval(interval))
    .filter(isDatedInterval)
    .filter((interval) => interval.startAt < interval.endAt)
    .sort(compareIntervals);

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

  return merged.map(intervalToState);
}

function subtractIntervals(
  desiredIntervals: HistoryInterval[],
  coverageIntervals: HistoryInterval[]
): HistoryInterval[] {
  const desired = desiredIntervals
    .map((interval) => datedInterval(interval))
    .filter(isDatedInterval);
  const coverage = coverageIntervals
    .map((interval) => datedInterval(interval))
    .filter(isDatedInterval);
  const missing: DatedInterval[] = [];

  for (const desiredInterval of desired) {
    let cursor = desiredInterval.startAt;

    for (const coveredInterval of coverage) {
      if (coveredInterval.endAt <= cursor) {
        continue;
      }
      if (coveredInterval.startAt >= desiredInterval.endAt) {
        break;
      }
      if (coveredInterval.startAt > cursor) {
        missing.push({
          endAt: minDate(coveredInterval.startAt, desiredInterval.endAt),
          startAt: cursor
        });
      }
      if (coveredInterval.endAt > cursor) {
        cursor = maxDate(cursor, coveredInterval.endAt);
      }
      if (cursor >= desiredInterval.endAt) {
        break;
      }
    }

    if (cursor < desiredInterval.endAt) {
      missing.push({
        endAt: desiredInterval.endAt,
        startAt: cursor
      });
    }
  }

  return missing.map(intervalToState);
}

function clipIntervalsForDisplay(
  intervals: HistoryInterval[],
  displayStartAt: Date | null
): HistoryInterval[] {
  if (displayStartAt === null) {
    return intervals;
  }

  return intervals.flatMap((interval) => {
    const dated = datedInterval(interval);
    if (dated === null) {
      return [];
    }
    const startAt = dated.startAt < displayStartAt ? displayStartAt : dated.startAt;
    return startAt < dated.endAt ? [intervalToState({ ...dated, startAt })] : [];
  });
}

function datedInterval(interval: HistoryInterval): DatedInterval | null {
  const startAt = new Date(interval.startAt);
  const endAt = new Date(interval.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return null;
  }
  return {
    endAt,
    ...(interval.messageCount === undefined ? {} : { messageCount: interval.messageCount }),
    startAt
  };
}

function isDatedInterval(interval: DatedInterval | null): interval is DatedInterval {
  return interval !== null;
}

function intervalToState(interval: DatedInterval): HistoryInterval {
  return {
    endAt: interval.endAt.toISOString(),
    ...(interval.messageCount === undefined ? {} : { messageCount: interval.messageCount }),
    startAt: interval.startAt.toISOString()
  };
}

function upsertJob(jobs: HistoryJob[], nextJob: HistoryJob): HistoryJob[] {
  const existing = jobs.find((job) => job.id === nextJob.id);
  const merged: HistoryJob = existing === undefined ? nextJob : { ...existing, ...nextJob };

  return [...jobs.filter((job) => job.id !== nextJob.id), merged].sort(compareJobs);
}

function compareTargets(left: HistoryTarget, right: HistoryTarget): number {
  return left.id.localeCompare(right.id);
}

function compareJobs(left: HistoryJob, right: HistoryJob): number {
  const endDifference = Date.parse(right.endAt) - Date.parse(left.endAt);
  if (endDifference !== 0) {
    return endDifference;
  }
  return Date.parse(right.startAt) - Date.parse(left.startAt);
}

function compareIntervals(left: DatedInterval, right: DatedInterval): number {
  const startDifference = left.startAt.getTime() - right.startAt.getTime();
  return startDifference === 0 ? left.endAt.getTime() - right.endAt.getTime() : startDifference;
}

function displayStartDate(state: SelectedHistoryState): Date | null {
  if (state.chat?.historyStartAt === null || state.chat?.historyStartAt === undefined) {
    return null;
  }
  const date = new Date(state.chat.historyStartAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function selectedChatId(state: SelectedHistoryState): string | null {
  return state.chat?.id ?? null;
}

function eventOccurredAt(event: ControlPlaneEvent): string {
  if (event.occurredAt instanceof Date) {
    return event.occurredAt.toISOString();
  }
  if (typeof event.occurredAt === 'string' && event.occurredAt.length > 0) {
    return event.occurredAt;
  }
  return '';
}

function isValidInterval(startAt: string, endAt: string): boolean {
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  return Number.isFinite(start) && Number.isFinite(end) && start < end;
}

function sameInterval(left: HistoryInterval, right: HistoryInterval): boolean {
  return (
    Date.parse(left.startAt) === Date.parse(right.startAt) &&
    Date.parse(left.endAt) === Date.parse(right.endAt)
  );
}

function containsInterval(container: HistoryInterval, interval: HistoryInterval): boolean {
  return (
    Date.parse(container.startAt) <= Date.parse(interval.startAt) &&
    Date.parse(container.endAt) >= Date.parse(interval.endAt)
  );
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function normalizedDateString(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function setMergedMessageCount(
  interval: DatedInterval,
  nextMessageCount: number | undefined
): void {
  const count =
    interval.messageCount === undefined && nextMessageCount === undefined
      ? undefined
      : (interval.messageCount ?? 0) + (nextMessageCount ?? 0);
  if (count === undefined) {
    delete interval.messageCount;
    return;
  }
  interval.messageCount = count;
}

function minDate(left: Date, right: Date): Date {
  return left < right ? left : right;
}

function maxDate(left: Date, right: Date): Date {
  return left > right ? left : right;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return asRecord(value) !== undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
