import type { SelectedHistoryState } from '../stores/controlPlaneTypes.js';
import { timelinePosition } from './timelineBounds.js';
import { formatDate } from './timelineFormatters.js';
import {
  jobKey,
  mergeHistoryDetailsForDisplay,
  normalizeIntervals,
  timelineCoverage,
  timelineJobs,
  toDates,
  visibleCoverageIntervals,
  visibleJobDetails
} from './timelineIntervals.js';
import {
  coverageSegmentTooltip,
  jobSegmentTooltip,
  timelineHoverItem
} from './timelineTooltips.js';
import type {
  TimelineCoverageInterval,
  TimelineHistoryDetail,
  TimelineJob,
  TimelineSegment
} from './timelineTypes.js';

export function coverageGapSegment(
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

export function coverageTimelineSegment(
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

export function jobTimelineSegment(job: TimelineJob, min: Date, max: Date): TimelineSegment[] {
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

export function targetHighlightTimelineSegments(
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

export function targetUnionTimelineSegments(
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

export function timelineEmptyGaps(
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
