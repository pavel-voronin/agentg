import type {
  DashboardEvent,
  HistorySyncBoundary,
  HistorySyncInterval,
  HistorySyncRange,
  HistorySyncTarget,
  SelectedHistorySyncState
} from './views.js';

type DatedInterval = {
  endAt: Date;
  messageCount?: number;
  startAt: Date;
};

const TELEGRAM_HISTORY_TICK_MS = 1000;

export function applyTimelineEvent(
  state: SelectedHistorySyncState,
  event: DashboardEvent
): boolean {
  const type = event.type;
  if (type === 'telegram.history.coverage.changed') {
    return applyCoverageChanged(state, event);
  }
  if (type === 'history-sync.target.upserted') {
    return applyTargetUpserted(state, event);
  }
  if (type === 'history-sync.target.deleted' || type === 'history-sync.target.auto_deleted') {
    return applyTargetDeleted(state, event);
  }
  return false;
}

function applyCoverageChanged(state: SelectedHistorySyncState, event: DashboardEvent): boolean {
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

function applyTargetUpserted(state: SelectedHistorySyncState, event: DashboardEvent): boolean {
  const target = historySyncTargetFromEvent(event);
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

function applyTargetDeleted(state: SelectedHistorySyncState, event: DashboardEvent): boolean {
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

function recomputeTimelineCoverage(state: SelectedHistorySyncState): void {
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

function coverageEventIntervals(event: DashboardEvent): (HistorySyncInterval & {
  chatId: string;
})[] {
  const data = asRecord(event.data);
  return asRecords(data?.intervals).flatMap((interval) => {
    const chatId = asString(asRecord(interval.chat)?.id) ?? asString(interval.chatId);
    const normalized = normalizeHistorySyncInterval(interval);
    return chatId === undefined || normalized === null ? [] : [{ ...normalized, chatId }];
  });
}

function historySyncTargetFromEvent(event: DashboardEvent): HistorySyncTarget | null {
  const target = asRecord(asRecord(event.data)?.target);
  const chatId = asString(target?.chatId);
  const id = asString(target?.id);
  const projected = normalizeHistorySyncInterval(asRecord(target?.projected));
  const range = normalizeHistorySyncRange(asRecord(target?.range));

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

function normalizeHistorySyncInterval(
  value: Record<string, unknown> | undefined
): HistorySyncInterval | null {
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

function normalizeHistorySyncRange(
  value: Record<string, unknown> | undefined
): HistorySyncRange | null {
  const start = normalizeHistorySyncBoundary(asRecord(value?.start));
  const end = normalizeHistorySyncBoundary(asRecord(value?.end));
  return start === null || end === null ? null : { end, start };
}

function normalizeHistorySyncBoundary(
  value: Record<string, unknown> | undefined
): HistorySyncBoundary | null {
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

function intervalFromTarget(target: HistorySyncTarget): HistorySyncInterval[] {
  return target.projected === undefined ? [] : [target.projected];
}

function mergeCoverageIntervals(intervals: HistorySyncInterval[]): HistorySyncInterval[] {
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

function mergeIntervals(intervals: HistorySyncInterval[]): HistorySyncInterval[] {
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
  desiredIntervals: HistorySyncInterval[],
  coverageIntervals: HistorySyncInterval[]
): HistorySyncInterval[] {
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
  intervals: HistorySyncInterval[],
  displayStartAt: Date | null
): HistorySyncInterval[] {
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

function datedInterval(interval: HistorySyncInterval): DatedInterval | null {
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

function intervalToState(interval: DatedInterval): HistorySyncInterval {
  return {
    endAt: interval.endAt.toISOString(),
    ...(interval.messageCount === undefined ? {} : { messageCount: interval.messageCount }),
    startAt: interval.startAt.toISOString()
  };
}

function compareTargets(left: HistorySyncTarget, right: HistorySyncTarget): number {
  return left.id.localeCompare(right.id);
}

function compareIntervals(left: DatedInterval, right: DatedInterval): number {
  const startDifference = left.startAt.getTime() - right.startAt.getTime();
  return startDifference === 0 ? left.endAt.getTime() - right.endAt.getTime() : startDifference;
}

function displayStartDate(state: SelectedHistorySyncState): Date | null {
  if (state.chat?.historySyncStartAt === null || state.chat?.historySyncStartAt === undefined) {
    return null;
  }
  const date = new Date(state.chat.historySyncStartAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function selectedChatId(state: SelectedHistorySyncState): string | null {
  return state.chat?.id ?? null;
}

function isValidInterval(startAt: string, endAt: string): boolean {
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  return Number.isFinite(start) && Number.isFinite(end) && start < end;
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
