import {
  mergeIntervals,
  orderIntervalsClosestToPresent,
  projectHistoryRange,
  splitIntervals,
  type HistoryRangeProjectionContext
} from './ranges.js';
import type { HistoryInterval, HistoryTarget } from './types.js';

export type HistorySyncProjectionOptions = HistoryRangeProjectionContext & {
  chatId: string;
  syncWindowMilliseconds?: number;
  targets: HistoryTarget[];
};

export function projectSyncIntervalsForChat(
  options: HistorySyncProjectionOptions
): HistoryInterval[] {
  const desired = projectTargetsForChat(options.targets, options.chatId, options);
  return options.syncWindowMilliseconds === undefined
    ? orderIntervalsClosestToPresent(desired)
    : splitIntervals(desired, options.syncWindowMilliseconds);
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

export function isOneShotHistoryTarget(target: HistoryTarget): boolean {
  return (
    target.templateId === undefined &&
    target.range.start.kind === 'absolute' &&
    target.range.end.kind === 'absolute'
  );
}
