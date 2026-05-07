import type { SelectedHistoryState } from '@agentg/shared/control-plane/views';
import type {
  TimelineCoverageInterval,
  TimelineHistoryDetail,
  TimelineInterval,
  TimelineJob,
  TimelineRawInterval,
  TimelineTarget
} from './timelineTypes.js';

export function coverageIntervalKey(interval: TimelineInterval): string {
  return `${interval.startAt.toISOString()}|${interval.endAt.toISOString()}`;
}

export function jobKey(job: TimelineJob): string {
  return String(job.id ?? '');
}

export function mergeHistoryDetailsForDisplay(
  details: TimelineHistoryDetail[]
): TimelineInterval[] {
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

export function normalizeIntervals(intervals: TimelineRawInterval[]): TimelineInterval[] {
  return intervals
    .map(toDates)
    .filter((interval): interval is TimelineInterval => interval !== null)
    .sort((left, right) => left.startAt.getTime() - right.startAt.getTime())
    .reduce<TimelineInterval[]>((acc, interval) => {
      const previous = acc.at(-1);
      if (!previous || interval.startAt > previous.endAt) {
        acc.push({
          endAt: interval.endAt,
          ...(interval.messageCount === undefined ? {} : { messageCount: interval.messageCount }),
          startAt: interval.startAt
        });
        return acc;
      }
      if (interval.endAt > previous.endAt) {
        previous.endAt = interval.endAt;
      }
      setMergedMessageCount(previous, interval.messageCount);
      return acc;
    }, []);
}

export function targetKey(target: TimelineTarget): string {
  return target.id ?? '';
}

export function timelineCoverage(data: SelectedHistoryState): TimelineRawInterval[] {
  return data.coverage;
}

export function timelineJobs(data: SelectedHistoryState): TimelineJob[] {
  return data.jobs;
}

export function timelineTargets(data: SelectedHistoryState): TimelineTarget[] {
  return data.targets;
}

export function toDates(raw: TimelineRawInterval): TimelineInterval | null {
  const startAt = new Date(raw.startAt ?? '');
  const endAt = new Date(raw.endAt ?? '');
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return null;
  return { ...raw, endAt, startAt };
}

export function visibleCoverageIntervals(
  intervals: TimelineRawInterval[],
  min: Date,
  max: Date
): TimelineCoverageInterval[] {
  return normalizeIntervals(intervals)
    .filter((interval) => interval.endAt > min && interval.startAt < max)
    .map((interval) => ({
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

export function visibleJobDetails(
  jobs: TimelineJob[],
  min: Date,
  max: Date
): TimelineHistoryDetail[] {
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

export function visibleTargetDetails(
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
