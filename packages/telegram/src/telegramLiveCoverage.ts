import {
  listTelegramHistoryChatIds,
  closeTelegramHistoryLiveWindow,
  extendTelegramHistoryLiveWindow,
  openTelegramHistoryLiveWindow,
  recoverTelegramHistoryLiveWindows,
  registerTelegramHistoryLiveChats
} from './telegramHistoryCoverage.js';
import { ceilToTelegramSecond, floorToTelegramSecond } from './telegramHistoryTime.js';
import type { TelegramDatabase as AppDatabase } from './database.js';

export type TelegramLiveCoverageObserver = {
  markConnected(at?: Date): Promise<void>;
  markDisconnected(): Promise<void>;
  recordLiveMessage(chatId: string, messageDate: Date, observedUntil?: Date): Promise<void>;
  syncKnownChats(at?: Date): Promise<void>;
  tick(at?: Date): Promise<void>;
  wait(): Promise<void>;
};

export type TelegramLiveCoverageObserverOptions = {
  database: AppDatabase;
  now?: () => Date;
};

const TELEGRAM_LIVE_COVERAGE_CHAT_REFRESH_MS = 60_000;

export function createTelegramLiveCoverageObserver(
  options: TelegramLiveCoverageObserverOptions
): TelegramLiveCoverageObserver {
  const now = options.now ?? (() => new Date());
  let connected = false;
  let connectedSince: Date | undefined;
  let activeWindowId: number | undefined;
  let knownChatsSyncedAt: Date | undefined;
  const knownLiveChatIds = new Set<string>();
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

  const syncKnownChatsAt = async (eligibleFrom: Date): Promise<void> => {
    if (!connected) {
      return;
    }

    const chatIds = await listTelegramHistoryChatIds(options.database);
    await registerTelegramHistoryLiveChats(options.database, chatIds, eligibleFrom);
    for (const chatId of chatIds) {
      knownLiveChatIds.add(chatId);
    }
    knownChatsSyncedAt = eligibleFrom;
  };

  const refreshKnownChatsIfDue = async (at: Date): Promise<void> => {
    if (
      knownChatsSyncedAt !== undefined &&
      at.getTime() - knownChatsSyncedAt.getTime() < TELEGRAM_LIVE_COVERAGE_CHAT_REFRESH_MS
    ) {
      return;
    }

    await syncKnownChatsAt(at);
  };

  return {
    markConnected(at = now()): Promise<void> {
      return enqueue(async () => {
        if (connected && connectedSince !== undefined && activeWindowId !== undefined) {
          return;
        }

        const connectedAt = ceilToTelegramSecond(at);
        await recoverTelegramHistoryLiveWindows(options.database);
        activeWindowId = await openTelegramHistoryLiveWindow(options.database, connectedAt);
        connected = true;
        connectedSince = connectedAt;
        knownChatsSyncedAt = undefined;
        await syncKnownChatsAt(connectedAt);
      });
    },
    markDisconnected(): Promise<void> {
      return enqueue(async () => {
        if (activeWindowId !== undefined) {
          await closeTelegramHistoryLiveWindow(
            options.database,
            activeWindowId,
            ceilToTelegramSecond(now()),
            'disconnected'
          );
        }

        connected = false;
        connectedSince = undefined;
        activeWindowId = undefined;
        knownChatsSyncedAt = undefined;
        knownLiveChatIds.clear();
      });
    },
    recordLiveMessage(chatId: string, messageDate: Date): Promise<void> {
      return enqueue(async () => {
        if (!connected || connectedSince === undefined || activeWindowId === undefined) {
          return;
        }

        const normalizedMessageStart = maxDate(floorToTelegramSecond(messageDate), connectedSince);
        if (knownLiveChatIds.has(chatId)) {
          return;
        }
        await registerTelegramHistoryLiveChats(options.database, [chatId], normalizedMessageStart);
        knownLiveChatIds.add(chatId);
      });
    },
    syncKnownChats(at = now()): Promise<void> {
      return enqueue(() => syncKnownChatsAt(ceilToTelegramSecond(at)));
    },
    tick(at = now()): Promise<void> {
      return enqueue(async () => {
        if (!connected || activeWindowId === undefined) {
          return;
        }

        const endAt = ceilToTelegramSecond(at);
        await extendTelegramHistoryLiveWindow(options.database, activeWindowId, endAt);
        await refreshKnownChatsIfDue(endAt);
      });
    },
    wait(): Promise<void> {
      return pending;
    }
  };
}

function maxDate(first: Date, second: Date): Date {
  return first > second ? first : second;
}
