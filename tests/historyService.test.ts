import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app/createApp.js';
import { createAppEvent, type AppEvent } from '../src/bus/events.js';
import type { EventBus } from '../src/bus/eventBus.js';
import type { TelegramTdlibClient } from '../src/telegram/tdlibClient.js';

describe('HistoryService', () => {
  it('records Telegram message events through direct TelegramService DI', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'agentg-history-'));
    const app = createApp({
      cwd,
      env: {
        AGENTG_SQLITE_PATH: './history.sqlite'
      }
    });
    const historyEvents: AppEvent[] = [];

    app.eventBus.subscribe('history.message.recorded', (event) => {
      historyEvents.push(event);
    });

    try {
      await app.start();
      await app.eventBus.publish(
        createAppEvent({
          data: {
            authenticated: true,
            configured: true,
            connected: true
          },
          occurredAt: new Date(Date.now() - 2000),
          source: 'test',
          type: 'telegram.tdlib.status'
        })
      );
      await app.services.telegram.ingestUpdate({
        _: 'updateNewMessage',
        message: {
          _: 'message',
          chat_id: 42,
          content: {
            _: 'messageText',
            text: {
              _: 'formattedText',
              text: 'history ping'
            }
          },
          date: 1_700_000_100,
          id: 77
        }
      });

      const messages = app.services.history.listMessages('42');
      const coverage = app.services.history.getCoverage('42');

      expect(messages).toEqual([
        {
          chatId: '42',
          contentType: 'messageText',
          messageDate: '2023-11-14T22:15:00.000Z',
          messageId: '77',
          observedAt: expect.any(String) as string,
          text: 'history ping',
          updatedAt: expect.any(String) as string
        }
      ]);
      expect(coverage).toHaveLength(1);
      expect(coverage[0]?.chatId).toBe('42');
      expect(historyEvents).toHaveLength(1);
    } finally {
      await app.stop();
    }
  });

  it('creates backfill jobs only for missing coverage', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'agentg-history-'));
    const app = createApp({
      cwd,
      env: {
        AGENTG_SQLITE_PATH: './history.sqlite'
      }
    });

    try {
      const jobs = app.services.history.createBackfillJobs({
        chatId: '42',
        jobWindowMilliseconds: 60_000,
        targets: [
          {
            chatId: '42',
            endAt: new Date('2024-01-01T00:02:00.000Z'),
            startAt: new Date('2024-01-01T00:00:00.000Z')
          }
        ]
      });

      expect(jobs).toHaveLength(2);
      expect(jobs.map((job) => job.status)).toEqual(['queued', 'queued']);
    } finally {
      await app.stop();
    }
  });

  it('executes target backfill jobs through direct TelegramService calls', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'agentg-history-backfill-'));
    const app = createApp({
      cwd,
      env: {
        AGENTG_SQLITE_PATH: './history-backfill.sqlite',
        BACKFILL_REQUEST_DELAY_MS: '1'
      }
    });

    try {
      await app.start();
      app.services.telegram.setTdlibClient(createFakeHistoryTdlibClient());
      await app.services.telegram.ingestUpdate({
        _: 'updateNewChat',
        chat: {
          _: 'chat',
          id: 42,
          title: 'Backfill Chat',
          type: {
            _: 'chatTypePrivate',
            user_id: 42
          }
        }
      });

      const completed = waitForEvent(app.eventBus, 'history.job.completed');
      app.services.history.upsertTarget({
        chatId: '42',
        end: '2024-01-01T00:01:00.000Z',
        start: '2024-01-01T00:00:00.000Z'
      });
      await completed;

      expect(app.services.history.listMessages('42')).toEqual([
        expect.objectContaining({
          chatId: '42',
          contentType: 'messageText',
          messageDate: '2024-01-01T00:00:30.000Z',
          messageId: '2',
          text: 'from history'
        })
      ]);
      expect(app.services.history.getCoverage('42')).toEqual([
        {
          chatId: '42',
          endAt: new Date('2024-01-01T00:01:00.000Z'),
          source: 'backfill',
          startAt: new Date('2024-01-01T00:00:00.000Z')
        }
      ]);
      expect(app.services.history.getOverview()).toMatchObject({
        pendingJobs: 0,
        runningJobs: 0
      });
    } finally {
      await app.stop();
    }
  });
});

function createFakeHistoryTdlibClient(): TelegramTdlibClient {
  return {
    close: () => Promise.resolve(),
    getChat: () =>
      Promise.resolve({
        _: 'chat',
        id: 42,
        title: 'Backfill Chat',
        type: {
          _: 'chatTypePrivate',
          user_id: 42
        }
      }),
    getChatHistory: () =>
      Promise.resolve({
        _: 'messages',
        messages: [
          telegramTextMessage(2, 1_704_067_230, 'from history'),
          telegramTextMessage(1, 1_704_067_190, 'before target')
        ]
      }),
    getChatMessageByDate: () => Promise.resolve(telegramTextMessage(2, 1_704_067_230, 'anchor')),
    getChats: () => Promise.resolve({ _: 'chats', chat_ids: [42] }),
    getMessage: (_chatId, messageId) =>
      Promise.resolve(telegramTextMessage(Number(messageId), 1_704_067_230, 'from history')),
    getUser: () =>
      Promise.resolve({
        _: 'user',
        first_name: 'Backfill',
        id: 42,
        last_name: 'User',
        type: {
          _: 'userTypeRegular'
        }
      }),
    loadChats: () => Promise.resolve(),
    login: () => Promise.resolve(),
    onError: () => ({
      unsubscribe() {
        return;
      }
    }),
    onUpdate: () => ({
      unsubscribe() {
        return;
      }
    })
  };
}

function telegramTextMessage(messageId: number, date: number, text: string): Record<string, unknown> {
  return {
    _: 'message',
    chat_id: 42,
    content: {
      _: 'messageText',
      text: {
        _: 'formattedText',
        text
      }
    },
    date,
    id: messageId
  };
}

function waitForEvent(eventBus: EventBus, type: string): Promise<AppEvent> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      reject(new Error(`Timed out waiting for ${type}`));
    }, 2000);
    const subscription = eventBus.subscribe(type, (event) => {
      clearTimeout(timeout);
      subscription.unsubscribe();
      resolve(event);
    });
  });
}
