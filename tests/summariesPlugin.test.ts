import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app/createApp.js';

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
    } finally {
      await app.stop();
    }
  });
});
