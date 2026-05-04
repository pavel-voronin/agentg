import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app/createApp.js';
import type { EventBus } from '../src/bus/eventBus.js';
import type { AppEvent } from '../src/bus/events.js';

describe('summaries plugin', () => {
  it('loads in-process and uses direct app services', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'agentg-summaries-'));
    const app = createApp({
      cwd,
      env: {
        AGENTG_SQLITE_PATH: './summaries.sqlite'
      }
    });

    try {
      await app.start();
      expect(app.plugins.registry.list().map((plugin) => plugin.name)).toEqual(['summaries']);

      await app.services.telegram.ingestUpdate({
        _: 'updateNewMessage',
        message: {
          _: 'message',
          chat_id: 7,
          content: {
            _: 'messageText',
            text: {
              _: 'formattedText',
              text: 'summarize me'
            }
          },
          date: 1_700_000_200,
          id: 8
        }
      });

      const invalidated = app.plugins.summaries.readChatSummary('7');
      expect(invalidated.invalidation).toMatchObject({
        chatId: '7',
        reason: 'telegram-message-changed'
      });

      const result = app.plugins.summaries.requestChatSummary({
        chatId: '7',
        reason: 'test'
      });

      expect(result.summary.sourceReferences).toEqual([
        {
          messageDate: '2023-11-14T22:16:40.000Z',
          messageId: '8'
        }
      ]);
      expect(result.summary.summary).toContain('1 source message');
      expect(app.plugins.summaries.readChatSummary('7').invalidation).toBeNull();

      app.repositories.history.addCoverage({
        chatId: '7',
        endAt: new Date('2024-01-01T00:01:00.000Z'),
        source: 'backfill',
        startAt: new Date('2024-01-01T00:00:00.000Z')
      });
      const invalidatedByTarget = waitForEvent(app.eventBus, 'summaries.summary.invalidated');
      app.services.history.upsertTarget({
        chatId: '7',
        end: '2024-01-01T00:01:00.000Z',
        start: '2024-01-01T00:00:00.000Z'
      });

      await invalidatedByTarget;
      expect(app.plugins.summaries.readChatSummary('7').invalidation).toMatchObject({
        chatId: '7',
        reason: 'history-state-changed'
      });
    } finally {
      await app.stop();
    }
  });
});

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
