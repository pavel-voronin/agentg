import { jobKey } from './timelineIntervals.js';
import { formatDuration, formatInteger, formatTimelineDate } from './timelineFormatters.js';
import type {
  TimelineBoundary,
  TimelineDetailType,
  TimelineHoverItem,
  TimelineInterval,
  TimelineJob,
  TimelineTarget,
  TimelineTooltip
} from './timelineTypes.js';

export function coverageSegmentTooltip(
  raw: { messageCount?: number },
  interval: TimelineInterval
): TimelineTooltip {
  const startAt = interval.originalStartAt ?? interval.startAt;
  const endAt = interval.originalEndAt ?? interval.endAt;
  return {
    count:
      raw.messageCount === undefined
        ? 'unknown messages'
        : `${formatInteger(raw.messageCount)} messages`,
    duration: formatDuration(endAt.getTime() - startAt.getTime()),
    from: formatTimelineDate(startAt),
    kind: 'Coverage',
    range: `${formatTimelineDate(startAt)} -> ${formatTimelineDate(endAt)}`,
    to: formatTimelineDate(endAt)
  };
}

export function jobSegmentTooltip(job: TimelineJob, interval: TimelineInterval): TimelineTooltip {
  return {
    count: `${job.status ?? ''} job #${jobKey(job)}`,
    duration: formatDuration(interval.endAt.getTime() - interval.startAt.getTime()),
    from: formatTimelineDate(interval.startAt),
    kind: 'Job',
    range: `${formatTimelineDate(interval.startAt)} -> ${formatTimelineDate(interval.endAt)}`,
    to: formatTimelineDate(interval.endAt)
  };
}

export function targetBoundaryDisplay(
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

export function targetSegmentTooltip(
  target: TimelineTarget,
  interval: TimelineInterval
): TimelineTooltip {
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

export function timelineHoverItem(
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
