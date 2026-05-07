import { describe, expect, it } from 'vitest';

import { historyCoverageChangedData, historyJobEventData } from '../../src/events.js';

describe('history sync event payloads', () => {
  it('publishes coverage changes as direct per-chat intervals', () => {
    expect(
      historyCoverageChangedData([
        {
          chatId: 'chat-b',
          endAt: new Date('2026-05-01T03:00:00.000Z'),
          startAt: new Date('2026-05-01T02:00:00.000Z')
        },
        {
          chatId: 'chat-a',
          endAt: new Date('2026-05-01T01:00:00.000Z'),
          startAt: new Date('2026-05-01T00:00:00.000Z')
        }
      ])
    ).toEqual({
      chatCount: 2,
      endAt: '2026-05-01T03:00:00.000Z',
      intervals: [
        {
          chatId: 'chat-a',
          endAt: '2026-05-01T01:00:00.000Z',
          startAt: '2026-05-01T00:00:00.000Z'
        },
        {
          chatId: 'chat-b',
          endAt: '2026-05-01T03:00:00.000Z',
          startAt: '2026-05-01T02:00:00.000Z'
        }
      ],
      startAt: '2026-05-01T00:00:00.000Z'
    });
  });

  it('publishes created jobs with the fields needed by timeline reducers', () => {
    expect(
      historyJobEventData({
        chatId: 'chat-a',
        endAt: new Date('2026-05-01T10:00:00.000Z'),
        id: '42',
        startAt: new Date('2026-05-01T00:00:00.000Z'),
        status: 'pending'
      })
    ).toEqual({
      chatId: 'chat-a',
      jobEnd: '2026-05-01T10:00:00.000Z',
      jobId: '42',
      jobStart: '2026-05-01T00:00:00.000Z'
    });
  });
});
