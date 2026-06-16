import type { HistoryCoverageState } from '../historyCoverageState.js';
import { timelinePosition } from './timelineBounds.js';
import { formatDate } from './timelineFormatters.js';
import {
  normalizeIntervals,
  timelineCoverage,
  visibleCoverageIntervals
} from './timelineIntervals.js';
import { coverageSegmentTooltip, timelineHoverItem } from './timelineTooltips.js';
import type { TimelineCoverageInterval, TimelineSegment } from './timelineTypes.js';

export function coverageGapSegment(
  gap: { endAt: Date; startAt: Date },
  min: Date,
  max: Date
): TimelineSegment {
  const position = timelinePosition(gap, min, max, 0);
  const label = `Request messages for ${formatDate(gap.startAt)} -> ${formatDate(gap.endAt)}`;
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

export function timelineEmptyGaps(
  data: HistoryCoverageState,
  min: Date,
  max: Date
): { endAt: Date; startAt: Date }[] {
  const normalized = normalizeIntervals(visibleCoverageIntervals(timelineCoverage(data), min, max));
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
