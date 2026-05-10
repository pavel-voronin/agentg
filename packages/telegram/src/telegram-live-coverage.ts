import type { EventBus } from '@agentg/events/bus';

import { createTelegramHistoryCoverageChangedEvent } from './integration-events.js';
import {
  addTelegramHistoryCoverageBatch,
  listTelegramHistoryChatIds,
  normalizeCoverageSegments,
  type TelegramHistoryCoverageInterval
} from './telegram-history-coverage.js';
import { countTelegramMessagesInIntervals } from './telegram-message-counts.js';
import {
  ceilToTelegramSecond,
  floorToTelegramSecond,
  normalizeTelegramHistoryInterval
} from './telegram-history-time.js';
import type { TelegramDatabase as AppDatabase } from './database.js';

export type TelegramLiveCoverageObserver = {
  markConnected(at?: Date): Promise<void>;
  markDisconnected(): Promise<void>;
  recordLiveMessage(chatId: string, messageDate: Date, observedUntil?: Date): Promise<void>;
  tick(at?: Date): Promise<void>;
  wait(): Promise<void>;
};

export type TelegramLiveCoverageObserverOptions = {
  database: AppDatabase;
  eventBus: EventBus;
  now?: () => Date;
};

export function createTelegramLiveCoverageObserver(
  options: TelegramLiveCoverageObserverOptions
): TelegramLiveCoverageObserver {
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
    extraInterval?: TelegramHistoryCoverageInterval
  ): Promise<void> => {
    if (!connected || connectedSince === undefined) {
      return;
    }

    const normalizedEndAt = ceilToTelegramSecond(endAt);
    const intervals = observedCoverageIntervals(
      await listTelegramHistoryChatIds(options.database),
      checkpoints,
      connectedSince,
      normalizedEndAt,
      extraInterval
    );

    if (intervals.length === 0) {
      return;
    }

    const result = await addTelegramHistoryCoverageBatch(options.database, intervals);
    if (result.intervals.length > 0) {
      const counts = await countTelegramMessagesInIntervals(options.database, result.intervals);
      options.eventBus.publish(
        createTelegramHistoryCoverageChangedEvent({
          intervals: result.intervals.map((interval, index) => ({
            ...interval,
            messageCount: counts[index] ?? 0
          }))
        })
      );
    }

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
  extraInterval?: TelegramHistoryCoverageInterval
): TelegramHistoryCoverageInterval[] {
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

  return normalizeCoverageSegments(
    intervals
      .map((interval) => ({
        ...normalizeTelegramHistoryInterval(interval),
        coveredAt: endAt
      }))
      .filter((interval) => interval.startAt < interval.endAt)
  );
}

function uniqueChatIds(chatIds: string[]): string[] {
  return [...new Set(chatIds)].sort();
}

function maxDate(first: Date, second: Date): Date {
  return first > second ? first : second;
}
