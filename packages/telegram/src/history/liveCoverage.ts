import {
  listHistoryChatIds,
  closeHistoryLiveWindow,
  extendHistoryLiveWindow,
  openHistoryLiveWindow,
  recoverHistoryLiveWindows,
  registerHistoryLiveChats
} from './coverage.js';
import { ceilToHistorySecond, floorToHistorySecond } from './time.js';
import type { Database } from '../database/client.js';

export type LiveCoverageObserver = {
  markConnected: (at?: Date) => Promise<void>;
  markDisconnected: () => Promise<void>;
  recordLiveMessage: (chatId: string, messageDate: Date, observedUntil?: Date) => Promise<void>;
  syncKnownChats: (at?: Date) => Promise<void>;
  tick: (at?: Date) => Promise<void>;
  wait: () => Promise<void>;
};

export type LiveCoverageObserverOptions = {
  database: Database;
  now?: () => Date;
};

const LIVE_COVERAGE_CHAT_REFRESH_MS = 60_000;

export function createLiveCoverageObserver(
  options: LiveCoverageObserverOptions
): LiveCoverageObserver {
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

    const chatIds = await listHistoryChatIds(options.database);
    await registerHistoryLiveChats(options.database, chatIds, eligibleFrom);
    for (const chatId of chatIds) {
      knownLiveChatIds.add(chatId);
    }
    knownChatsSyncedAt = eligibleFrom;
  };

  const refreshKnownChatsIfDue = async (at: Date): Promise<void> => {
    if (
      knownChatsSyncedAt !== undefined &&
      at.getTime() - knownChatsSyncedAt.getTime() < LIVE_COVERAGE_CHAT_REFRESH_MS
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

        const connectedAt = ceilToHistorySecond(at);
        await recoverHistoryLiveWindows(options.database);
        activeWindowId = await openHistoryLiveWindow(options.database, connectedAt);
        connected = true;
        connectedSince = connectedAt;
        knownChatsSyncedAt = undefined;
        await syncKnownChatsAt(connectedAt);
      });
    },
    markDisconnected(): Promise<void> {
      return enqueue(async () => {
        if (activeWindowId !== undefined) {
          await closeHistoryLiveWindow(
            options.database,
            activeWindowId,
            ceilToHistorySecond(now()),
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

        const normalizedMessageStart = maxDate(floorToHistorySecond(messageDate), connectedSince);
        if (knownLiveChatIds.has(chatId)) {
          return;
        }
        await registerHistoryLiveChats(options.database, [chatId], normalizedMessageStart);
        knownLiveChatIds.add(chatId);
      });
    },
    syncKnownChats(at = now()): Promise<void> {
      return enqueue(() => syncKnownChatsAt(ceilToHistorySecond(at)));
    },
    tick(at = now()): Promise<void> {
      return enqueue(async () => {
        if (!connected || activeWindowId === undefined) {
          return;
        }

        const endAt = ceilToHistorySecond(at);
        await extendHistoryLiveWindow(options.database, activeWindowId, endAt);
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
