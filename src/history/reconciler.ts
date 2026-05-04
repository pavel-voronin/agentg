import { normalizeCoverageIntervals, type HistoryCoverageInterval } from './coverage.js';
import { splitIntervals, subtractIntervals, type HistoryInterval } from './ranges.js';

export type HistoryTarget = HistoryInterval & {
  chatId: string;
};

export type HistoryBackfillJobInput = HistoryInterval & {
  chatId: string;
};

export type ReconcileChatOptions = {
  chatId: string;
  coverage: HistoryCoverageInterval[];
  targets: HistoryTarget[];
  jobWindowMilliseconds?: number;
};

export function reconcileChat(options: ReconcileChatOptions): HistoryBackfillJobInput[] {
  const desired = options.targets
    .filter((target) => target.chatId === options.chatId)
    .map(({ startAt, endAt }) => ({ endAt, startAt }));
  const coverage = normalizeCoverageIntervals(options.coverage)
    .filter((interval) => interval.chatId === options.chatId)
    .map(({ startAt, endAt }) => ({ endAt, startAt }));
  const missing = subtractIntervals(desired, coverage);
  const intervals =
    options.jobWindowMilliseconds === undefined
      ? missing
      : splitIntervals(missing, options.jobWindowMilliseconds);

  return intervals.map((interval) => ({
    ...interval,
    chatId: options.chatId
  }));
}
