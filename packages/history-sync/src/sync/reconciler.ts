import {
  mergeIntervals,
  orderIntervalsClosestToPresent,
  projectHistorySyncRange,
  splitIntervals,
  type HistorySyncRangeProjectionContext
} from '../range/ranges.js';
import type { HistorySyncInterval, HistorySyncTarget } from '../model/types.js';

export type HistorySyncProjectionOptions = HistorySyncRangeProjectionContext & {
  chatId: string;
  syncWindowMilliseconds?: number;
  targets: HistorySyncTarget[];
};

export function projectSyncIntervalsForChat(
  options: HistorySyncProjectionOptions
): HistorySyncInterval[] {
  const desired = projectTargetsForChat(options.targets, options.chatId, options);
  return options.syncWindowMilliseconds === undefined
    ? orderIntervalsClosestToPresent(desired)
    : splitIntervals(desired, options.syncWindowMilliseconds);
}

export function projectTargetsForChat(
  targets: HistorySyncTarget[],
  chatId: string,
  context: HistorySyncRangeProjectionContext
): HistorySyncInterval[] {
  return mergeIntervals(
    targets
      .filter((target) => target.chatId === chatId)
      .map((target) => projectHistorySyncRange(target.range, context))
  );
}

export function isOneShotHistorySyncTarget(target: HistorySyncTarget): boolean {
  return (
    target.templateId === undefined &&
    target.range.start.kind === 'absolute' &&
    target.range.end.kind === 'absolute'
  );
}
