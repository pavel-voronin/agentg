import type { SelectedHistoryState } from '../stores/controlPlaneTypes.js';

const DAY_MS = 86400000;
const TELEGRAM_HISTORY_START_AT = new Date('2013-08-14T00:00:00.000Z');
export const TIMELINE_MIN_WINDOW_MS = 1000;
export const TIMELINE_SELECTION_MIN_PX = 3;
export const TIMELINE_WHEEL_GESTURE_IDLE_MS = 180;
export const TIMELINE_WHEEL_AXIS_DOMINANCE = 1.35;
export const TIMELINE_WHEEL_AXIS_INTENT_PX = 8;

export type TimelineViewport = {
  endAt: number;
  startAt: number;
};

export type TimelineBounds = {
  max: Date;
  min: Date;
};

export type TimelinePosition = {
  left: number;
  width: number;
};

export type TimelineDateLabel = {
  align: 'left' | 'right';
  delta: string;
  key: string;
  label: string;
  widthCh: number;
};

export type TimelineHoverItem = {
  duration: string;
  extra: string;
  from: string;
  fromNote?: string;
  key: string;
  kind: TimelineDetailType;
  label: string;
  to: string;
  toNote?: string;
};

export type TimelineDetailType = 'coverage' | 'job' | 'target';

export type TimelineDetail = {
  count?: string;
  cursor?: boolean;
  duration: string;
  endAt: Date;
  endNote?: string;
  endValue: string;
  id?: string;
  item: TimelineCoverageInterval | TimelineJob | TimelineTarget;
  key: string;
  startNote?: string;
  startValue: string;
  startAt: Date;
  status?: string;
  templateId?: string;
  type: TimelineDetailType;
};

export type TimelineDetailSection = {
  items: TimelineDetail[];
  title: string;
  type: TimelineDetailType;
};

export type TimelineSegment =
  | {
      kind: 'coverage';
      ariaLabel: string;
      hover: TimelineHoverItem;
      key: string;
      position: TimelinePosition;
    }
  | {
      kind: 'gap';
      ariaLabel: string;
      endIso: string;
      key: string;
      position: TimelinePosition;
      startIso: string;
    }
  | {
      kind: 'job';
      ariaLabel: string;
      hover: TimelineHoverItem;
      key: string;
      position: TimelinePosition;
      running: boolean;
    }
  | {
      kind: 'target-highlight';
      key: string;
      keys: string[];
      position: TimelinePosition;
    }
  | {
      kind: 'target-union';
      key: string;
      position: TimelinePosition;
    };

export type TimelineViewModel = TimelineBounds & {
  dateLabels: TimelineDateLabel[];
  detailSections: TimelineDetailSection[];
  detailsEmpty: boolean;
  segments: TimelineSegment[];
};

type TimelineRawInterval = {
  endAt?: Date | string;
  messageCount?: number;
  startAt?: Date | string;
};

type TimelineInterval = {
  endAt: Date;
  messageCount?: number;
  originalEndAt?: Date;
  originalStartAt?: Date;
  startAt: Date;
};

type TimelineCoverageInterval = TimelineInterval & {
  key: string;
  messageCount: number;
};

type TimelineTarget = {
  id?: string;
  projected?: TimelineRawInterval | null;
  range?: TimelineRange;
  templateId?: string;
};

type TimelineBoundary =
  | {
      at?: string;
      kind?: 'absolute';
    }
  | {
      expression?: string;
      kind?: 'expression';
    };

type TimelineRange = {
  end?: TimelineBoundary;
  start?: TimelineBoundary;
};

type TimelineJob = TimelineRawInterval & {
  cursor?: unknown;
  id?: number | string;
  status?: string;
};

type TimelineHistoryDetailCommon = {
  endAt: Date;
  key: string;
  startAt: Date;
};

type TimelineHistoryDetail =
  | (TimelineHistoryDetailCommon & {
      item: TimelineCoverageInterval;
      type: 'coverage';
    })
  | (TimelineHistoryDetailCommon & {
      item: TimelineJob;
      type: 'job';
    })
  | (TimelineHistoryDetailCommon & {
      item: TimelineTarget;
      type: 'target';
    });

export function buildTimelineViewModel(options: {
  coverageTableOpen: boolean;
  data: SelectedHistoryState;
  viewport: TimelineViewport;
}): TimelineViewModel {
  const min = new Date(options.viewport.startAt);
  const max = new Date(options.viewport.endAt);
  const targetDetails = visibleTargetDetails(timelineTargets(options.data), min, max);
  const segments: TimelineSegment[] = [
    ...targetUnionTimelineSegments(targetDetails, min, max),
    ...targetHighlightTimelineSegments(targetDetails, min, max),
    ...timelineJobs(options.data).flatMap((job) => jobTimelineSegment(job, min, max)),
    ...visibleCoverageIntervals(timelineCoverage(options.data), min, max).map((interval) =>
      coverageTimelineSegment(interval, min, max)
    ),
    ...timelineEmptyGaps(options.data, targetDetails, min, max).map((gap) =>
      coverageGapSegment(gap, min, max)
    )
  ];
  const detailSections = options.coverageTableOpen
    ? groupHistoryDetailItems(historyDetailItems(options.data, min, max)).map(detailSection)
    : [];

  return {
    dateLabels: [
      timelineDateLabel(min, min.getTime() - max.getTime(), 'left'),
      timelineDateLabel(max, max.getTime() - min.getTime(), 'right')
    ],
    detailSections,
    detailsEmpty: options.coverageTableOpen && detailSections.length === 0,
    max,
    min,
    segments
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clampTimelineViewport(
  viewport: TimelineViewport,
  physical: TimelineViewport
): TimelineViewport {
  const physicalSpan = physical.endAt - physical.startAt;
  let span = Math.max(TIMELINE_MIN_WINDOW_MS, viewport.endAt - viewport.startAt);
  span = Math.min(span, physicalSpan);
  let startAt = viewport.startAt;
  let endAt = startAt + span;
  if (endAt > physical.endAt) {
    endAt = physical.endAt;
    startAt = endAt - span;
  }
  if (startAt < physical.startAt) {
    startAt = physical.startAt;
    endAt = startAt + span;
  }
  return { endAt, startAt };
}

export function historyItemsAtTime(
  data: SelectedHistoryState,
  min: Date,
  max: Date,
  at: number
): TimelineHoverItem[] {
  return historyDetailItems(data, min, max)
    .filter((detail) => detail.startAt.getTime() <= at && detail.endAt.getTime() >= at)
    .map(historyHoverItem)
    .sort(compareHistoryHoverItems);
}

export function timelineDetailHoverItem(detail: TimelineDetail): TimelineHoverItem {
  return {
    duration: detail.duration,
    extra:
      detail.type === 'coverage'
        ? (detail.count ?? '')
        : detail.type === 'job'
          ? (detail.status ?? '')
          : '',
    from: detail.startValue,
    key: detail.key,
    kind: detail.type,
    label: detail.type === 'target' ? 'Target' : detail.type === 'job' ? 'Job' : 'Coverage',
    to: detail.endValue,
    ...(detail.startNote === undefined ? {} : { fromNote: detail.startNote }),
    ...(detail.endNote === undefined ? {} : { toNote: detail.endNote })
  };
}

export function timelinePhysicalBounds(data: SelectedHistoryState): TimelineViewport {
  const now = new Date();
  const historyStart = data.chat?.historyStartAt
    ? new Date(data.chat.historyStartAt)
    : TELEGRAM_HISTORY_START_AT;
  const startAt = Number.isNaN(historyStart.getTime())
    ? TELEGRAM_HISTORY_START_AT.getTime()
    : historyStart.getTime();
  const endAt = now.getTime();
  return {
    endAt,
    startAt: Math.min(startAt, endAt - TIMELINE_MIN_WINDOW_MS)
  };
}

export function timelineViewportFromPreset(
  data: SelectedHistoryState,
  viewportDays: number
): TimelineViewport {
  const physical = timelinePhysicalBounds(data);
  const endAt = physical.endAt;
  const startAt = viewportDays > 0 ? endAt - viewportDays * DAY_MS : physical.startAt;
  return clampTimelineViewport({ endAt, startAt }, physical);
}

function coverageGapSegment(
  gap: { endAt: Date; startAt: Date },
  min: Date,
  max: Date
): TimelineSegment {
  const position = timelinePosition(gap, min, max, 0);
  const label = `Add target for ${formatDate(gap.startAt)} -> ${formatDate(gap.endAt)}`;
  return {
    ariaLabel: label,
    endIso: gap.endAt.toISOString(),
    key: `${gap.startAt.toISOString()}|${gap.endAt.toISOString()}`,
    kind: 'gap',
    position,
    startIso: gap.startAt.toISOString()
  };
}

function coverageSegmentTooltip(
  raw: { messageCount?: number },
  interval: TimelineInterval
): TimelineTooltip {
  const startAt = interval.originalStartAt ?? interval.startAt;
  const endAt = interval.originalEndAt ?? interval.endAt;
  return {
    count: `${formatInteger(raw.messageCount ?? 0)} messages`,
    duration: formatDuration(endAt.getTime() - startAt.getTime()),
    from: formatTimelineDate(startAt),
    kind: 'Coverage',
    range: `${formatTimelineDate(startAt)} -> ${formatTimelineDate(endAt)}`,
    to: formatTimelineDate(endAt)
  };
}

function coverageTimelineSegment(
  interval: TimelineCoverageInterval,
  min: Date,
  max: Date
): TimelineSegment {
  const position = timelinePosition(interval, min, max, 0.25);
  const tooltip = coverageSegmentTooltip(interval, interval);
  return {
    ariaLabel: `${tooltip.range}, ${tooltip.count ?? ''}`,
    hover: timelineHoverItem('coverage', interval.key, tooltip),
    key: interval.key,
    kind: 'coverage',
    position
  };
}

function coverageIntervalKey(interval: TimelineInterval): string {
  return `${interval.startAt.toISOString()}|${interval.endAt.toISOString()}`;
}

function compareHistoryDetailItems(
  left: TimelineHistoryDetail,
  right: TimelineHistoryDetail
): number {
  const startDifference = left.startAt.getTime() - right.startAt.getTime();
  if (startDifference !== 0) return startDifference;
  const endDifference = left.endAt.getTime() - right.endAt.getTime();
  if (endDifference !== 0) return endDifference;
  return historyDetailTypeOrder(left.type) - historyDetailTypeOrder(right.type);
}

function compareHistoryHoverItems(left: TimelineHoverItem, right: TimelineHoverItem): number {
  return historyHoverTypeOrder(left.kind) - historyHoverTypeOrder(right.kind);
}

function detailSection(section: {
  items: TimelineHistoryDetail[];
  type: TimelineDetailType;
}): TimelineDetailSection {
  const title = section.type === 'target' ? 'Target' : section.type === 'job' ? 'Jobs' : 'Coverage';
  return {
    items: section.items.map(timelineDetail),
    title,
    type: section.type
  };
}

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16).replace('T', ' ');
}

function formatDuration(milliseconds: number): string {
  const minutes = Math.max(0, Math.round(milliseconds / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = minutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${String(days)}d`);
  if (hours > 0) parts.push(`${String(hours)}h`);
  if (remainingMinutes > 0 || parts.length === 0) parts.push(`${String(remainingMinutes)}m`);
  return parts.join(' ');
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}

function formatSignedDuration(milliseconds: number): string {
  if (milliseconds === 0) {
    return '0m';
  }
  return `${milliseconds < 0 ? '-' : '+'}${formatDuration(Math.abs(milliseconds))}`;
}

function formatTimelineDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 19).replace('T', ' ');
}

function groupHistoryDetailItems(
  items: TimelineHistoryDetail[]
): { items: TimelineHistoryDetail[]; type: TimelineDetailType }[] {
  return items.reduce<{ items: TimelineHistoryDetail[]; type: TimelineDetailType }[]>(
    (sections, item) => {
      const last = sections.at(-1);
      if (last?.type !== item.type) {
        sections.push({
          items: [item],
          type: item.type
        });
        return sections;
      }
      last.items.push(item);
      return sections;
    },
    []
  );
}

function historyDetailItems(
  data: SelectedHistoryState,
  min: Date,
  max: Date
): TimelineHistoryDetail[] {
  return [
    ...visibleTargetDetails(timelineTargets(data), min, max),
    ...visibleJobDetails(timelineJobs(data), min, max),
    ...visibleCoverageIntervals(timelineCoverage(data), min, max).map((interval) => ({
      endAt: interval.endAt,
      item: interval,
      key: interval.key,
      startAt: interval.startAt,
      type: 'coverage' as const
    }))
  ].sort(compareHistoryDetailItems);
}

function historyDetailTypeOrder(type: TimelineDetailType): number {
  if (type === 'target') return 0;
  if (type === 'job') return 1;
  return 2;
}

function historyHoverItem(detail: TimelineHistoryDetail): TimelineHoverItem {
  const tooltip =
    detail.type === 'coverage'
      ? coverageSegmentTooltip(detail.item, detail.item)
      : detail.type === 'target'
        ? targetSegmentTooltip(detail.item, detail)
        : jobSegmentTooltip(detail.item, detail);
  return timelineHoverItem(detail.type, detail.key, tooltip);
}

function historyHoverTypeOrder(kind: TimelineDetailType): number {
  if (kind === 'coverage') return 0;
  if (kind === 'target') return 1;
  return 2;
}

function jobKey(job: TimelineJob): string {
  return String(job.id ?? '');
}

function jobSegmentTooltip(job: TimelineJob, interval: TimelineInterval): TimelineTooltip {
  return {
    count: `${job.status ?? ''} job #${String(job.id ?? '')}`,
    duration: formatDuration(interval.endAt.getTime() - interval.startAt.getTime()),
    from: formatTimelineDate(interval.startAt),
    kind: 'Job',
    range: `${formatTimelineDate(interval.startAt)} -> ${formatTimelineDate(interval.endAt)}`,
    to: formatTimelineDate(interval.endAt)
  };
}

function jobTimelineSegment(job: TimelineJob, min: Date, max: Date): TimelineSegment[] {
  const interval = toDates(job);
  if (!interval || interval.endAt <= min || interval.startAt >= max) return [];
  const position = timelinePosition(interval, min, max, 0.25);
  const tooltip = jobSegmentTooltip(job, interval);
  return [
    {
      ariaLabel: `${tooltip.range}, ${tooltip.count ?? ''}`,
      hover: timelineHoverItem('job', jobKey(job), tooltip),
      key: jobKey(job),
      kind: 'job',
      position,
      running: job.status === 'running'
    }
  ];
}

function mergeHistoryDetailsForDisplay(details: TimelineHistoryDetail[]): TimelineInterval[] {
  return details
    .map((detail) => ({ endAt: detail.endAt, startAt: detail.startAt }))
    .sort((left, right) => left.startAt.getTime() - right.startAt.getTime())
    .reduce<TimelineInterval[]>((merged, interval) => {
      const previous = merged.at(-1);
      if (!previous || interval.startAt > previous.endAt) {
        merged.push({ ...interval });
        return merged;
      }
      if (interval.endAt > previous.endAt) {
        previous.endAt = interval.endAt;
      }
      return merged;
    }, []);
}

function normalizeIntervals(intervals: TimelineRawInterval[]): TimelineInterval[] {
  return intervals
    .map(toDates)
    .filter((interval): interval is TimelineInterval => interval !== null)
    .sort((left, right) => left.startAt.getTime() - right.startAt.getTime())
    .reduce<TimelineInterval[]>((acc, interval) => {
      const previous = acc.at(-1);
      if (!previous || interval.startAt > previous.endAt) {
        acc.push({
          endAt: interval.endAt,
          messageCount: interval.messageCount ?? 0,
          startAt: interval.startAt
        });
        return acc;
      }
      if (interval.endAt > previous.endAt) {
        previous.endAt = interval.endAt;
      }
      previous.messageCount = (previous.messageCount ?? 0) + (interval.messageCount ?? 0);
      return acc;
    }, []);
}

function partitionTargetDetailsForDisplay(
  details: TimelineHistoryDetail[]
): { endAt: Date; keys: string[]; startAt: Date }[] {
  const points = [
    ...new Set(details.flatMap((detail) => [detail.startAt.getTime(), detail.endAt.getTime()]))
  ].sort((left, right) => left - right);
  const partitions: { endAt: Date; keys: string[]; startAt: Date }[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const startAt = points[index - 1];
    const endAt = points[index];
    if (startAt === undefined || endAt === undefined || startAt >= endAt) continue;
    const keys = details
      .filter((detail) => detail.startAt.getTime() < endAt && detail.endAt.getTime() > startAt)
      .map((detail) => detail.key);
    if (keys.length === 0) continue;
    partitions.push({
      endAt: new Date(endAt),
      keys,
      startAt: new Date(startAt)
    });
  }
  return partitions;
}

function targetHighlightTimelineSegments(
  details: TimelineHistoryDetail[],
  min: Date,
  max: Date
): TimelineSegment[] {
  return partitionTargetDetailsForDisplay(details)
    .map((interval) => ({
      interval,
      position: timelinePosition(interval, min, max, 0)
    }))
    .filter((item) => item.position.width > 0)
    .map((item) => ({
      key: item.interval.keys.join('|'),
      keys: item.interval.keys,
      kind: 'target-highlight' as const,
      position: item.position
    }));
}

function targetKey(target: TimelineTarget): string {
  return target.id ?? '';
}

function targetSegmentTooltip(target: TimelineTarget, interval: TimelineInterval): TimelineTooltip {
  const start = targetBoundaryDisplay(target.range?.start, interval.startAt);
  const end = targetBoundaryDisplay(target.range?.end, interval.endAt);
  return {
    duration: formatDuration(interval.endAt.getTime() - interval.startAt.getTime()),
    from: start.value,
    ...(start.note === undefined ? {} : { fromNote: start.note }),
    kind: 'Target',
    range: `${start.value} -> ${end.value}`,
    to: end.value,
    ...(end.note === undefined ? {} : { toNote: end.note })
  };
}

function targetUnionTimelineSegments(
  details: TimelineHistoryDetail[],
  min: Date,
  max: Date
): TimelineSegment[] {
  return mergeHistoryDetailsForDisplay(details).map((interval, index) => ({
    key: `target-union:${String(index)}:${interval.startAt.toISOString()}`,
    kind: 'target-union' as const,
    position: timelinePosition(interval, min, max, 0.25)
  }));
}

function timelineCoverage(data: SelectedHistoryState): TimelineRawInterval[] {
  return Array.isArray(data.coverage) ? (data.coverage as TimelineRawInterval[]) : [];
}

function timelineDateLabel(
  date: Date,
  deltaMilliseconds: number,
  align: 'left' | 'right'
): TimelineDateLabel {
  const label = formatDate(date);
  const delta = formatSignedDuration(deltaMilliseconds);
  return {
    align,
    delta,
    key: `${align}:${date.toISOString()}`,
    label,
    widthCh: Math.max(label.length, delta.length)
  };
}

function timelineDetail(detail: TimelineHistoryDetail): TimelineDetail {
  const duration = formatDuration(detail.endAt.getTime() - detail.startAt.getTime());
  if (detail.type === 'target') {
    const target = detail.item;
    const start = targetBoundaryDisplay(target.range?.start, detail.startAt);
    const end = targetBoundaryDisplay(target.range?.end, detail.endAt);
    return {
      duration,
      endAt: detail.endAt,
      endValue: end.value,
      id: targetKey(target),
      item: target,
      key: detail.key,
      startValue: start.value,
      startAt: detail.startAt,
      ...(end.note === undefined ? {} : { endNote: end.note }),
      ...(start.note === undefined ? {} : { startNote: start.note }),
      templateId: target.templateId ?? '-',
      type: detail.type
    };
  }
  if (detail.type === 'job') {
    const job = detail.item;
    return {
      cursor: job.cursor !== undefined && job.cursor !== null,
      duration,
      endAt: detail.endAt,
      endValue: formatTimelineDate(detail.endAt),
      id: jobKey(job),
      item: job,
      key: detail.key,
      startValue: formatTimelineDate(detail.startAt),
      startAt: detail.startAt,
      status: job.status ?? '',
      type: detail.type
    };
  }
  const interval = detail.item;
  return {
    count: formatInteger(interval.messageCount),
    duration,
    endAt: detail.endAt,
    endValue: formatTimelineDate(detail.endAt),
    item: interval,
    key: detail.key,
    startValue: formatTimelineDate(detail.startAt),
    startAt: detail.startAt,
    type: detail.type
  };
}

function timelineEmptyGaps(
  data: SelectedHistoryState,
  targetDetails: TimelineHistoryDetail[],
  min: Date,
  max: Date
): { endAt: Date; startAt: Date }[] {
  const blocks = [
    ...visibleCoverageIntervals(timelineCoverage(data), min, max),
    ...targetDetails,
    ...visibleJobDetails(timelineJobs(data), min, max)
  ];
  const normalized = normalizeIntervals(blocks);
  const gaps: { endAt: Date; startAt: Date }[] = [];
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    if (previous !== undefined && current !== undefined && current.startAt > previous.endAt) {
      gaps.push({
        endAt: current.startAt,
        startAt: previous.endAt
      });
    }
  }
  return gaps;
}

function timelineHoverItem(
  kind: TimelineDetailType,
  key: string,
  tooltip: TimelineTooltip
): TimelineHoverItem {
  return {
    duration: tooltip.duration,
    extra: kind === 'coverage' || kind === 'job' ? (tooltip.count ?? '') : '',
    from: tooltip.from,
    key,
    kind,
    label: tooltip.kind,
    to: tooltip.to,
    ...(tooltip.fromNote === undefined ? {} : { fromNote: tooltip.fromNote }),
    ...(tooltip.toNote === undefined ? {} : { toNote: tooltip.toNote })
  };
}

function targetBoundaryDisplay(
  boundary: TimelineBoundary | undefined,
  projected: Date
): { note?: string; value: string } {
  if (boundary?.kind === 'expression' && typeof boundary.expression === 'string') {
    return {
      note: formatTimelineDate(projected),
      value: boundary.expression
    };
  }
  return {
    value: formatTimelineDate(projected)
  };
}

function timelineJobs(data: SelectedHistoryState): TimelineJob[] {
  return Array.isArray(data.jobs) ? (data.jobs as TimelineJob[]) : [];
}

function timelinePosition(
  interval: { endAt: Date; startAt: Date },
  min: Date,
  max: Date,
  minWidth: number
): TimelinePosition {
  const start = Math.max(interval.startAt.getTime(), min.getTime());
  const end = Math.min(interval.endAt.getTime(), max.getTime());
  const total = max.getTime() - min.getTime();
  return {
    left: ((start - min.getTime()) / total) * 100,
    width: Math.max(((end - start) / total) * 100, minWidth)
  };
}

function timelineTargets(data: SelectedHistoryState): TimelineTarget[] {
  return Array.isArray(data.targets) ? (data.targets as TimelineTarget[]) : [];
}

function toDates(raw: TimelineRawInterval): TimelineInterval | null {
  const startAt = new Date(raw.startAt ?? '');
  const endAt = new Date(raw.endAt ?? '');
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return null;
  return { ...raw, endAt, startAt };
}

function visibleCoverageIntervals(
  intervals: TimelineRawInterval[],
  min: Date,
  max: Date
): TimelineCoverageInterval[] {
  return normalizeIntervals(intervals)
    .filter((interval) => interval.endAt > min && interval.startAt < max)
    .map((interval) => ({
      endAt: interval.endAt < max ? interval.endAt : max,
      key: coverageIntervalKey(interval),
      messageCount: interval.messageCount ?? 0,
      originalEndAt: interval.endAt,
      originalStartAt: interval.startAt,
      startAt: interval.startAt > min ? interval.startAt : min
    }));
}

function visibleJobDetails(jobs: TimelineJob[], min: Date, max: Date): TimelineHistoryDetail[] {
  return jobs.flatMap((job) => {
    const interval = toDates(job);
    if (!interval || interval.endAt <= min || interval.startAt >= max) return [];
    return [
      {
        endAt: interval.endAt,
        item: job,
        key: jobKey(job),
        startAt: interval.startAt,
        type: 'job' as const
      }
    ];
  });
}

function visibleTargetDetails(
  targets: TimelineTarget[],
  min: Date,
  max: Date
): TimelineHistoryDetail[] {
  return targets.flatMap((target) => {
    const interval = target.projected ? toDates(target.projected) : null;
    if (!interval || interval.endAt <= min || interval.startAt >= max) return [];
    return [
      {
        endAt: interval.endAt,
        item: target,
        key: targetKey(target),
        startAt: interval.startAt,
        type: 'target' as const
      }
    ];
  });
}

type TimelineTooltip = {
  count?: string;
  duration: string;
  from: string;
  fromNote?: string;
  kind: string;
  range: string;
  to: string;
  toNote?: string;
};
