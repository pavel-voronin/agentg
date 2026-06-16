import type { HistoryCoverageState } from '../historyCoverageState.js';
import type {
  TimelineCoverageInterval,
  TimelineInterval,
  TimelineRawInterval
} from './timelineTypes.js';

export function coverageIntervalKey(interval: TimelineInterval): string {
  return `${interval.startAt.toISOString()}|${interval.endAt.toISOString()}`;
}

export function normalizeIntervals(intervals: TimelineRawInterval[]): TimelineInterval[] {
  return intervals
    .map(toDates)
    .filter((interval): interval is TimelineInterval => interval !== null)
    .sort((left, right) => left.startAt.getTime() - right.startAt.getTime())
    .reduce<TimelineInterval[]>((acc, interval) => {
      const previous = acc.at(-1);
      if (!previous || interval.startAt > previous.endAt) {
        acc.push({
          ...(interval.coveredAt === undefined ? {} : { coveredAt: interval.coveredAt }),
          endAt: interval.endAt,
          ...(interval.messageCount === undefined ? {} : { messageCount: interval.messageCount }),
          startAt: interval.startAt
        });
        return acc;
      }
      if (interval.endAt > previous.endAt) {
        previous.endAt = interval.endAt;
      }
      if (
        interval.coveredAt !== undefined &&
        (previous.coveredAt === undefined || interval.coveredAt > previous.coveredAt)
      ) {
        previous.coveredAt = interval.coveredAt;
      }
      setMergedMessageCount(previous, interval.messageCount);
      return acc;
    }, []);
}

export function timelineCoverage(data: HistoryCoverageState): TimelineRawInterval[] {
  return data.coverage;
}

export function toDates(raw: TimelineRawInterval): TimelineInterval | null {
  const startAt = new Date(raw.startAt ?? '');
  const endAt = new Date(raw.endAt ?? '');
  const coveredAt = raw.coveredAt === undefined ? undefined : new Date(raw.coveredAt);
  if (
    Number.isNaN(startAt.getTime()) ||
    Number.isNaN(endAt.getTime()) ||
    startAt >= endAt ||
    (coveredAt !== undefined && Number.isNaN(coveredAt.getTime()))
  ) {
    return null;
  }
  return {
    ...(coveredAt === undefined ? {} : { coveredAt }),
    endAt,
    ...(raw.messageCount === undefined ? {} : { messageCount: raw.messageCount }),
    startAt
  };
}

export function visibleCoverageIntervals(
  intervals: TimelineRawInterval[],
  min: Date,
  max: Date
): TimelineCoverageInterval[] {
  return normalizeIntervals(intervals)
    .filter((interval) => interval.endAt > min && interval.startAt < max)
    .map((interval) => ({
      ...(interval.coveredAt === undefined ? {} : { coveredAt: interval.coveredAt }),
      endAt: interval.endAt < max ? interval.endAt : max,
      key: coverageIntervalKey(interval),
      ...(interval.messageCount === undefined ? {} : { messageCount: interval.messageCount }),
      originalEndAt: interval.endAt,
      originalStartAt: interval.startAt,
      startAt: interval.startAt > min ? interval.startAt : min
    }));
}

function setMergedMessageCount(
  interval: TimelineInterval,
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
