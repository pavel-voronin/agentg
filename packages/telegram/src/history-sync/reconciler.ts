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
