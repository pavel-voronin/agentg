import { formatDuration, formatInteger, formatTimelineDate } from './timelineFormatters.js';
import type {
  TimelineDetailType,
  TimelineHoverItem,
  TimelineInterval,
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

export function timelineHoverItem(
  kind: TimelineDetailType,
  key: string,
  tooltip: TimelineTooltip
): TimelineHoverItem {
  return {
    duration: tooltip.duration,
    extra: tooltip.count ?? '',
    from: tooltip.from,
    key,
    kind,
    label: tooltip.kind,
    to: tooltip.to
  };
}
