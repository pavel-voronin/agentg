import type { HistoryCoverageState } from '../historyCoverageState.js';
import { formatDuration, formatInteger, formatTimelineDate } from './timelineFormatters.js';
import { timelineCoverage, visibleCoverageIntervals } from './timelineIntervals.js';
import { coverageSegmentTooltip, timelineHoverItem } from './timelineTooltips.js';
import type {
  TimelineCoverageDetail,
  TimelineDetail,
  TimelineDetailSection,
  TimelineDetailType,
  TimelineHoverItem
} from './timelineTypes.js';

export function detailSection(section: {
  items: TimelineCoverageDetail[];
  type: TimelineDetailType;
}): TimelineDetailSection {
  return {
    items: section.items.map(timelineDetail),
    title: 'Coverage',
    type: section.type
  };
}

export function groupCoverageDetailItems(
  items: TimelineCoverageDetail[]
): { items: TimelineCoverageDetail[]; type: TimelineDetailType }[] {
  return items.reduce<{ items: TimelineCoverageDetail[]; type: TimelineDetailType }[]>(
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

export function coverageDetailItems(
  data: HistoryCoverageState,
  min: Date,
  max: Date
): TimelineCoverageDetail[] {
  return visibleCoverageIntervals(timelineCoverage(data), min, max)
    .map((interval) => ({
      endAt: interval.endAt,
      item: interval,
      key: interval.key,
      startAt: interval.startAt,
      type: 'coverage' as const
    }))
    .sort(compareCoverageDetailItems);
}

export function coverageItemsAtTime(
  data: HistoryCoverageState,
  min: Date,
  max: Date,
  at: number
): TimelineHoverItem[] {
  return coverageDetailItems(data, min, max)
    .filter((detail) => detail.startAt.getTime() <= at && detail.endAt.getTime() >= at)
    .map(coverageHoverItem);
}

export function timelineDetailHoverItem(detail: TimelineDetail): TimelineHoverItem {
  return {
    duration: detail.duration,
    extra: detail.count ?? '',
    from: detail.startValue,
    key: detail.key,
    kind: detail.type,
    label: 'Coverage',
    to: detail.endValue
  };
}

function compareCoverageDetailItems(
  left: TimelineCoverageDetail,
  right: TimelineCoverageDetail
): number {
  const startDifference = left.startAt.getTime() - right.startAt.getTime();
  if (startDifference !== 0) return startDifference;
  return left.endAt.getTime() - right.endAt.getTime();
}

function coverageHoverItem(detail: TimelineCoverageDetail): TimelineHoverItem {
  return timelineHoverItem(
    'coverage',
    detail.key,
    coverageSegmentTooltip(detail.item, detail.item)
  );
}

function timelineDetail(detail: TimelineCoverageDetail): TimelineDetail {
  const interval = detail.item;
  const displayStartAt = interval.originalStartAt ?? detail.startAt;
  const displayEndAt = interval.originalEndAt ?? detail.endAt;
  return {
    count: interval.messageCount === undefined ? 'unknown' : formatInteger(interval.messageCount),
    duration: formatDuration(displayEndAt.getTime() - displayStartAt.getTime()),
    endAt: detail.endAt,
    endValue: formatTimelineDate(displayEndAt),
    item: interval,
    key: detail.key,
    startValue: formatTimelineDate(displayStartAt),
    startAt: detail.startAt,
    type: detail.type
  };
}
