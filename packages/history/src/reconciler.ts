import {
  mergeIntervals,
  orderIntervalsClosestToPresent,
  projectHistoryRange,
  splitIntervals,
  subtractIntervals,
  type HistoryRangeProjectionContext
} from './ranges.js';
import { normalizeCoverageIntervals } from './coverage.js';
import type {
  BackfillJobInput,
  HistoryCoverageInterval,
  HistoryInterval,
  HistoryTarget
} from './types.js';

export type ReconcileChatOptions = HistoryRangeProjectionContext & {
  chatId: string;
  coverage: HistoryCoverageInterval[];
  jobWindowMilliseconds?: number;
  targets: HistoryTarget[];
};

export function reconcileChat(options: ReconcileChatOptions): BackfillJobInput[] {
  const desired = projectTargetsForChat(options.targets, options.chatId, options);
  const coverage = normalizeCoverageIntervals(options.coverage).filter(
    (interval) => interval.chatId === options.chatId
  );
  const missing = subtractIntervals(desired, coverage);
  const intervals =
    options.jobWindowMilliseconds === undefined
      ? orderIntervalsClosestToPresent(missing)
      : splitIntervals(missing, options.jobWindowMilliseconds);

  return intervals.map((interval) => ({
    ...interval,
    chatId: options.chatId
  }));
}

export function completedOneShotTargets(options: ReconcileChatOptions): HistoryTarget[] {
  const coverage = normalizeCoverageIntervals(options.coverage).filter(
    (interval) => interval.chatId === options.chatId
  );

  return options.targets
    .filter((target) => target.chatId === options.chatId)
    .filter(isOneShotHistoryTarget)
    .filter((target) => {
      const projected = projectHistoryRange(target.range, options);
      return coverage.some(
        (interval) => interval.startAt <= projected.startAt && interval.endAt >= projected.endAt
      );
    });
}

export function projectTargetsForChat(
  targets: HistoryTarget[],
  chatId: string,
  context: HistoryRangeProjectionContext
): HistoryInterval[] {
  return mergeIntervals(
    targets
      .filter((target) => target.chatId === chatId)
      .map((target) => projectHistoryRange(target.range, context))
  );
}

function isOneShotHistoryTarget(target: HistoryTarget): boolean {
  return (
    target.templateId === undefined &&
    target.range.start.kind === 'absolute' &&
    target.range.end.kind === 'absolute'
  );
}
