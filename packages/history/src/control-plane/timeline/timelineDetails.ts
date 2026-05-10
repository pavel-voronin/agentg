import type { SelectedHistoryState } from '../views.js';
import { formatDuration, formatInteger, formatTimelineDate } from './timelineFormatters.js';
import {
  targetKey,
  timelineCoverage,
  timelineTargets,
  visibleCoverageIntervals,
  visibleTargetDetails
} from './timelineIntervals.js';
import {
  coverageSegmentTooltip,
  targetBoundaryDisplay,
  targetSegmentTooltip,
  timelineHoverItem
} from './timelineTooltips.js';
import type {
  TimelineDetail,
  TimelineDetailSection,
  TimelineDetailType,
  TimelineHistoryDetail,
  TimelineHoverItem
} from './timelineTypes.js';

export function detailSection(section: {
  items: TimelineHistoryDetail[];
  type: TimelineDetailType;
}): TimelineDetailSection {
  const title = section.type === 'target' ? 'Target' : 'Coverage';
  return {
    items: section.items.map(timelineDetail),
    title,
    type: section.type
  };
}

export function groupHistoryDetailItems(
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

export function historyDetailItems(
  data: SelectedHistoryState,
  min: Date,
  max: Date
): TimelineHistoryDetail[] {
  return [
    ...visibleTargetDetails(timelineTargets(data), min, max),
    ...visibleCoverageIntervals(timelineCoverage(data), min, max).map((interval) => ({
      endAt: interval.endAt,
      item: interval,
      key: interval.key,
      startAt: interval.startAt,
      type: 'coverage' as const
    }))
  ].sort(compareHistoryDetailItems);
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
    extra: detail.type === 'coverage' ? (detail.count ?? '') : '',
    from: detail.startValue,
    key: detail.key,
    kind: detail.type,
    label: detail.type === 'target' ? 'Target' : 'Coverage',
    to: detail.endValue,
    ...(detail.startNote === undefined ? {} : { fromNote: detail.startNote }),
    ...(detail.endNote === undefined ? {} : { toNote: detail.endNote })
  };
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

function historyDetailTypeOrder(type: TimelineDetailType): number {
  if (type === 'target') return 0;
  return 1;
}

function historyHoverItem(detail: TimelineHistoryDetail): TimelineHoverItem {
  const tooltip =
    detail.type === 'coverage'
      ? coverageSegmentTooltip(detail.item, detail.item)
      : targetSegmentTooltip(detail.item, detail);
  return timelineHoverItem(detail.type, detail.key, tooltip);
}

function historyHoverTypeOrder(kind: TimelineDetailType): number {
  if (kind === 'coverage') return 0;
  return 1;
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
