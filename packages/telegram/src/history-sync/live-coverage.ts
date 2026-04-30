import type { AppDatabase } from '@agentg/database/client';
import { createIntegrationEvent } from '@agentg/shared/events/envelope';
import type { EventBus } from '@agentg/shared/events/bus';

import { normalizeCoverageIntervals } from './coverage.js';
import { addHistoryCoverageBatch, listKnownTelegramChatIds } from './store.js';
import {
  ceilToTelegramSecond,
  floorToTelegramSecond,
  normalizeTelegramHistoryInterval
} from './time.js';
import type { HistoryCoverageInterval } from './types.js';

export type LiveCoverageObserver = {
  markConnected(at?: Date): Promise<void>;
  markDisconnected(): Promise<void>;
  recordLiveMessage(chatId: string, messageDate: Date, observedUntil?: Date): Promise<void>;
  tick(at?: Date): Promise<void>;
  wait(): Promise<void>;
};

export type LiveCoverageObserverOptions = {
  addCoverageBatch: (intervals: HistoryCoverageInterval[]) => Promise<void>;
  listChatIds: () => Promise<string[]>;
  now?: () => Date;
  publishCoverageChanged?: (intervals: HistoryCoverageInterval[]) => void;
};

export function createDatabaseLiveCoverageObserver(
  database: AppDatabase,
  eventBus: EventBus
): LiveCoverageObserver {
  return createLiveCoverageObserver({
    addCoverageBatch: (intervals) => addHistoryCoverageBatch(database, intervals),
    listChatIds: () => listKnownTelegramChatIds(database),
    publishCoverageChanged: (intervals) => {
      const startAt = minDateFromList(intervals.map((interval) => interval.startAt));
      const endAt = maxDateFromList(intervals.map((interval) => interval.endAt));
      eventBus.publish(
        createIntegrationEvent({
          data: {
            chatCount: intervals.length,
            endAt: endAt.toISOString(),
            startAt: startAt.toISOString()
          },
          source: 'telegram.live',
          type: 'history.coverage.changed'
        })
      );
    }
  });
}

export function createLiveCoverageObserver(
  options: LiveCoverageObserverOptions
): LiveCoverageObserver {
  const now = options.now ?? (() => new Date());
  let connected = false;
  let connectedSince: Date | undefined;
  const checkpoints = new Map<string, Date>();
  let pending = Promise.resolve();

  const enqueue = (operation: () => Promise<void> | void): Promise<void> => {
    const current = pending
      .catch(() => undefined)
      .then(async () => {
        await operation();
      });
    pending = current.then(
      () => undefined,
      () => undefined
    );
    return current;
  };

  const flushUntil = async (
    endAt: Date,
    extraInterval?: HistoryCoverageInterval
  ): Promise<void> => {
    if (!connected || connectedSince === undefined) {
      return;
    }

    const normalizedEndAt = ceilToTelegramSecond(endAt);
    const intervals = observedCoverageIntervals(
      await options.listChatIds(),
      checkpoints,
      connectedSince,
      normalizedEndAt,
      extraInterval
    );

    if (intervals.length === 0) {
      return;
    }

    await options.addCoverageBatch(intervals);
    options.publishCoverageChanged?.(intervals);
    for (const interval of intervals) {
      checkpoints.set(interval.chatId, interval.endAt);
    }
  };

  return {
    markConnected(at = now()): Promise<void> {
      return enqueue(() => {
        if (connected && connectedSince !== undefined) {
          return;
        }

        const connectedAt = ceilToTelegramSecond(at);
        connected = true;
        connectedSince = connectedAt;
        checkpoints.clear();
      });
    },
    markDisconnected(): Promise<void> {
      return enqueue(() => {
        connected = false;
        connectedSince = undefined;
        checkpoints.clear();
      });
    },
    recordLiveMessage(chatId: string, messageDate: Date, observedUntil = now()): Promise<void> {
      return enqueue(async () => {
        if (!connected || connectedSince === undefined) {
          return;
        }

        const normalizedMessageStart = maxDate(floorToTelegramSecond(messageDate), connectedSince);
        const normalizedObservedUntil = ceilToTelegramSecond(observedUntil);
        const messageInterval =
          normalizedMessageStart >= normalizedObservedUntil
            ? undefined
            : normalizeTelegramHistoryInterval({
                chatId,
                endAt: normalizedObservedUntil,
                startAt: normalizedMessageStart
              });

        await flushUntil(normalizedObservedUntil, messageInterval);
      });
    },
    tick(at = now()): Promise<void> {
      return enqueue(() => flushUntil(at));
    },
    wait(): Promise<void> {
      return pending;
    }
  };
}

function observedCoverageIntervals(
  chatIds: string[],
  checkpoints: ReadonlyMap<string, Date>,
  connectedSince: Date,
  endAt: Date,
  extraInterval?: HistoryCoverageInterval
): HistoryCoverageInterval[] {
  const intervals = uniqueChatIds(chatIds).map((chatId) => {
    const checkpointAt = checkpoints.get(chatId) ?? connectedSince;
    return {
      chatId,
      endAt,
      startAt: checkpointAt
    };
  });

  if (extraInterval !== undefined) {
    intervals.push(extraInterval);
  }

  return normalizeCoverageIntervals(
    intervals
      .map(normalizeTelegramHistoryInterval)
      .filter((interval) => interval.startAt < interval.endAt)
  );
}

function uniqueChatIds(chatIds: string[]): string[] {
  return [...new Set(chatIds)].sort();
}

function minDate(first: Date, ...rest: Date[]): Date;
function minDate(...dates: Date[]): Date {
  const [first, ...rest] = dates;
  if (first === undefined) {
    throw new Error('minDate requires at least one date');
  }
  return rest.reduce((minimum, date) => (date < minimum ? date : minimum), first);
}

function minDateFromList(dates: Date[]): Date {
  const [first, ...rest] = dates;
  if (first === undefined) {
    throw new Error('minDateFromList requires at least one date');
  }
  return minDate(first, ...rest);
}

function maxDate(first: Date, ...rest: Date[]): Date;
function maxDate(...dates: Date[]): Date {
  const [first, ...rest] = dates;
  if (first === undefined) {
    throw new Error('maxDate requires at least one date');
  }
  return rest.reduce((maximum, date) => (date > maximum ? date : maximum), first);
}

function maxDateFromList(dates: Date[]): Date {
  const [first, ...rest] = dates;
  if (first === undefined) {
    throw new Error('maxDateFromList requires at least one date');
  }
  return maxDate(first, ...rest);
}
