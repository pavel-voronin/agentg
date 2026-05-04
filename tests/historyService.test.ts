import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app/createApp.js';
import type { AppEvent } from '../src/bus/events.js';

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
});
