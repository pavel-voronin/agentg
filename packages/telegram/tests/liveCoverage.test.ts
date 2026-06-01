import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  closeHistoryLiveWindow,
  extendHistoryLiveWindow,
  listHistoryChatIds,
  openHistoryLiveWindow,
  recoverHistoryLiveWindows,
  registerHistoryLiveChats
} from '../src/history/coverage.js';
import { createLiveCoverageObserver } from '../src/history/liveCoverage.js';
import type { Database } from '../src/database/client.js';

vi.mock('../src/history/coverage.js', () => ({
  closeHistoryLiveWindow: vi.fn(() => Promise.resolve(undefined)),
  extendHistoryLiveWindow: vi.fn(() => Promise.resolve(undefined)),
  listHistoryChatIds: vi.fn(() => Promise.resolve(['chat-a', 'chat-b'])),
  openHistoryLiveWindow: vi.fn(() => Promise.resolve(10)),
  recoverHistoryLiveWindows: vi.fn(() => Promise.resolve(undefined)),
  registerHistoryLiveChats: vi.fn(() => Promise.resolve(undefined))
}));

describe('Telegram live coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listHistoryChatIds).mockResolvedValue(['chat-a', 'chat-b']);
    vi.mocked(openHistoryLiveWindow).mockResolvedValue(10);
  });

  it('opens one global live window and registers known chats on connect', async () => {
    const database = fakeDatabase();
    const observer = createLiveCoverageObserver({
      database,
      now: () => new Date('2026-05-01T10:00:00.100Z')
    });

    await observer.markConnected();

    expect(recoverHistoryLiveWindows).toHaveBeenCalledTimes(1);
    expect(openHistoryLiveWindow).toHaveBeenCalledWith(
      database,
      new Date('2026-05-01T10:00:01.000Z')
    );
    expect(registerHistoryLiveChats).toHaveBeenCalledWith(
      database,
      ['chat-a', 'chat-b'],
      new Date('2026-05-01T10:00:01.000Z')
    );
  });

  it('extends only the active global window on tick', async () => {
    const database = fakeDatabase();
    const observer = createLiveCoverageObserver({
      database,
      now: () => new Date('2026-05-01T10:00:00.000Z')
    });

    await observer.markConnected();
    await observer.tick(new Date('2026-05-01T10:00:30.100Z'));

    expect(extendHistoryLiveWindow).toHaveBeenCalledWith(
      database,
      10,
      new Date('2026-05-01T10:00:31.000Z')
    );
  });

  it('registers a live message chat once without extending coverage per message', async () => {
    const database = fakeDatabase();
    const observer = createLiveCoverageObserver({
      database,
      now: () => new Date('2026-05-01T10:00:00.000Z')
    });

    await observer.markConnected();
    vi.mocked(registerHistoryLiveChats).mockClear();
    vi.mocked(extendHistoryLiveWindow).mockClear();

    await observer.recordLiveMessage('chat-c', new Date('2026-05-01T10:00:15.900Z'));
    await observer.recordLiveMessage('chat-c', new Date('2026-05-01T10:00:20.000Z'));

    expect(registerHistoryLiveChats).toHaveBeenCalledTimes(1);
    expect(registerHistoryLiveChats).toHaveBeenCalledWith(
      database,
      ['chat-c'],
      new Date('2026-05-01T10:00:15.000Z')
    );
    expect(extendHistoryLiveWindow).not.toHaveBeenCalled();
  });

  it('closes the active live window on disconnect', async () => {
    const database = fakeDatabase();
    const observer = createLiveCoverageObserver({
      database,
      now: () => new Date('2026-05-01T10:01:00.100Z')
    });

    await observer.markConnected();
    await observer.markDisconnected();

    expect(closeHistoryLiveWindow).toHaveBeenCalledWith(
      database,
      10,
      new Date('2026-05-01T10:01:01.000Z'),
      'disconnected'
    );
  });
});

function fakeDatabase(): Database {
  return {} as Database;
}
