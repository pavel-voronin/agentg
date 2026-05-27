import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  closeTelegramHistoryLiveWindow,
  extendTelegramHistoryLiveWindow,
  listTelegramHistoryChatIds,
  openTelegramHistoryLiveWindow,
  recoverTelegramHistoryLiveWindows,
  registerTelegramHistoryLiveChats
} from '../src/telegramHistoryCoverage.js';
import { createTelegramLiveCoverageObserver } from '../src/telegramLiveCoverage.js';
import type { TelegramDatabase } from '../src/database.js';

vi.mock('../src/telegramHistoryCoverage.js', () => ({
  closeTelegramHistoryLiveWindow: vi.fn(() => Promise.resolve(undefined)),
  extendTelegramHistoryLiveWindow: vi.fn(() => Promise.resolve(undefined)),
  listTelegramHistoryChatIds: vi.fn(() => Promise.resolve(['chat-a', 'chat-b'])),
  openTelegramHistoryLiveWindow: vi.fn(() => Promise.resolve(10)),
  recoverTelegramHistoryLiveWindows: vi.fn(() => Promise.resolve(undefined)),
  registerTelegramHistoryLiveChats: vi.fn(() => Promise.resolve(undefined))
}));

describe('Telegram live coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listTelegramHistoryChatIds).mockResolvedValue(['chat-a', 'chat-b']);
    vi.mocked(openTelegramHistoryLiveWindow).mockResolvedValue(10);
  });

  it('opens one global live window and registers known chats on connect', async () => {
    const database = fakeDatabase();
    const observer = createTelegramLiveCoverageObserver({
      database,
      now: () => new Date('2026-05-01T10:00:00.100Z')
    });

    await observer.markConnected();

    expect(recoverTelegramHistoryLiveWindows).toHaveBeenCalledTimes(1);
    expect(openTelegramHistoryLiveWindow).toHaveBeenCalledWith(
      database,
      new Date('2026-05-01T10:00:01.000Z')
    );
    expect(registerTelegramHistoryLiveChats).toHaveBeenCalledWith(
      database,
      ['chat-a', 'chat-b'],
      new Date('2026-05-01T10:00:01.000Z')
    );
  });

  it('extends only the active global window on tick', async () => {
    const database = fakeDatabase();
    const observer = createTelegramLiveCoverageObserver({
      database,
      now: () => new Date('2026-05-01T10:00:00.000Z')
    });

    await observer.markConnected();
    await observer.tick(new Date('2026-05-01T10:00:30.100Z'));

    expect(extendTelegramHistoryLiveWindow).toHaveBeenCalledWith(
      database,
      10,
      new Date('2026-05-01T10:00:31.000Z')
    );
  });

  it('registers a live message chat once without extending coverage per message', async () => {
    const database = fakeDatabase();
    const observer = createTelegramLiveCoverageObserver({
      database,
      now: () => new Date('2026-05-01T10:00:00.000Z')
    });

    await observer.markConnected();
    vi.mocked(registerTelegramHistoryLiveChats).mockClear();
    vi.mocked(extendTelegramHistoryLiveWindow).mockClear();

    await observer.recordLiveMessage(
      'chat-c',
      new Date('2026-05-01T10:00:15.900Z'),
      new Date('2026-05-01T10:00:16.200Z')
    );
    await observer.recordLiveMessage(
      'chat-c',
      new Date('2026-05-01T10:00:20.000Z'),
      new Date('2026-05-01T10:00:21.000Z')
    );

    expect(registerTelegramHistoryLiveChats).toHaveBeenCalledTimes(1);
    expect(registerTelegramHistoryLiveChats).toHaveBeenCalledWith(
      database,
      ['chat-c'],
      new Date('2026-05-01T10:00:15.000Z')
    );
    expect(extendTelegramHistoryLiveWindow).not.toHaveBeenCalled();
  });

  it('closes the active live window on disconnect', async () => {
    const database = fakeDatabase();
    const observer = createTelegramLiveCoverageObserver({
      database,
      now: () => new Date('2026-05-01T10:01:00.100Z')
    });

    await observer.markConnected();
    await observer.markDisconnected();

    expect(closeTelegramHistoryLiveWindow).toHaveBeenCalledWith(
      database,
      10,
      new Date('2026-05-01T10:01:01.000Z'),
      'disconnected'
    );
  });
});

function fakeDatabase(): TelegramDatabase {
  return {} as TelegramDatabase;
}
