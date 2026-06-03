import type { SelectedHistorySyncState } from '../views.js';
import { DAY_MS, TELEGRAM_HISTORY_START_AT, TIMELINE_MIN_WINDOW_MS } from './timelineConstants.js';
import { formatDate, formatSignedDuration } from './timelineFormatters.js';
import type { TimelineDateLabel, TimelinePosition, TimelineViewport } from './timelineTypes.js';

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

export function timelineDateLabel(
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

export function timelinePhysicalBounds(data: SelectedHistorySyncState): TimelineViewport {
  const now = new Date();
  const historySyncStart = data.chat?.historySyncStartAt
    ? new Date(data.chat.historySyncStartAt)
    : TELEGRAM_HISTORY_START_AT;
  const startAt = Number.isNaN(historySyncStart.getTime())
    ? TELEGRAM_HISTORY_START_AT.getTime()
    : historySyncStart.getTime();
  const endAt = now.getTime();
  return {
    endAt,
    startAt: Math.min(startAt, endAt - TIMELINE_MIN_WINDOW_MS)
  };
}

export function timelinePosition(
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

export function timelineViewportFromPreset(
  data: SelectedHistorySyncState,
  viewportDays: number
): TimelineViewport {
  const physical = timelinePhysicalBounds(data);
  const endAt = physical.endAt;
  const startAt = viewportDays > 0 ? endAt - viewportDays * DAY_MS : physical.startAt;
  return clampTimelineViewport({ endAt, startAt }, physical);
}
