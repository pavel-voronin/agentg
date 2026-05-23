import { describe, expect, it } from 'vitest';

import { coverageUpdateBatchFromEvent } from '../../src/control-plane/coverageUpdates.js';

describe('history sync coverage update view model', () => {
  it('summarizes one coverage event without counting every chat as a separate update', () => {
    expect(
      coverageUpdateBatchFromEvent({
        data: {
          intervals: [
            {
              chat: { _model: 'telegram.chat', id: 'chat-a' },
              endAt: '2026-05-01T01:00:00.000Z',
              startAt: '2026-05-01T00:00:00.000Z'
            },
            {
              chat: { _model: 'telegram.chat', id: 'chat-b' },
              endAt: '2026-05-01T01:00:00.000Z',
              startAt: '2026-05-01T00:00:00.000Z'
            }
          ]
        }
      })
    ).toEqual({
      chatCount: 2,
      intervalCount: 2,
      latestInterval: {
        chatId: 'chat-b',
        endAt: '2026-05-01T01:00:00.000Z',
        startAt: '2026-05-01T00:00:00.000Z'
      }
    });
  });

  it('ignores malformed coverage events', () => {
    expect(
      coverageUpdateBatchFromEvent({
        data: {
          intervals: [
            {
              chat: { _model: 'telegram.chat', id: 'chat-a' },
              startAt: '2026-05-01T00:00:00.000Z'
            }
          ]
        }
      })
    ).toBeNull();
  });
});
