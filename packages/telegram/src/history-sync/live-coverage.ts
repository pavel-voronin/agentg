import type { AppDatabase } from '@agentg/database/client';
import { createIntegrationEvent } from '@agentg/shared/events/envelope';
import type { EventBus } from '@agentg/shared/events/bus';

import { normalizeCoverageIntervals } from './coverage.js';
import { addHistoryCoverage, listKnownTelegramChatIds } from './store.js';
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
  addCoverage: (interval: HistoryCoverageInterval) => Promise<void>;
  listChatIds: () => Promise<string[]>;
  now?: () => Date;
  publishCoverageChanged?: (interval: HistoryCoverageInterval) => void;
};

export function createDatabaseLiveCoverageObserver(
  database: AppDatabase,
  eventBus: EventBus
): LiveCoverageObserver {
  return createLiveCoverageObserver({
    addCoverage: (interval) => addHistoryCoverage(database, interval),
    listChatIds: () => listKnownTelegramChatIds(database),
    publishCoverageChanged: (interval) => {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            chatId: interval.chatId,
            endAt: interval.endAt.toISOString(),
            startAt: interval.startAt.toISOString()
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

    for (const interval of intervals) {
      await options.addCoverage(interval);
      options.publishCoverageChanged?.(interval);
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

function maxDate(first: Date, second: Date): Date {
  return first > second ? first : second;
}
