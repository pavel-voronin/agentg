import { createTelegramMessagesObservedEvent } from '@agentg/telegram/integration-events';
import { describe, expect, it } from 'vitest';

import { TELEGRAM_HISTORY_PAST_BOUNDARY } from '../../src/constants.js';
import { coverageIntervalsFromTelegramMessagesObserved } from '../../src/telegram-observed-coverage.js';

describe('Telegram observed message coverage', () => {
  it('converts observed Telegram message pages to history coverage intervals', () => {
    const event = createTelegramMessagesObservedEvent({
      chatId: 'chat-a',
      endAt: new Date('2026-05-05T00:10:00.100Z'),
      fetchedMessages: 25,
      reachedStart: false,
      startAt: new Date('2026-05-05T00:00:00.900Z'),
      storedMessages: 25
    });

    expect(coverageIntervalsFromTelegramMessagesObserved(event)).toEqual([
      {
        chatId: 'chat-a',
        endAt: new Date('2026-05-05T00:10:01.000Z'),
        startAt: new Date('2026-05-05T00:00:00.000Z')
      }
    ]);
  });

  it('uses the history past boundary when the observed page reaches the start', () => {
    const event = createTelegramMessagesObservedEvent({
      chatId: 'chat-a',
      endAt: new Date('2026-05-05T00:10:00.000Z'),
      fetchedMessages: 1,
      reachedStart: true,
      startAt: null,
      storedMessages: 1
    });

    expect(coverageIntervalsFromTelegramMessagesObserved(event)).toEqual([
      {
        chatId: 'chat-a',
        endAt: new Date('2026-05-05T00:10:00.000Z'),
        startAt: TELEGRAM_HISTORY_PAST_BOUNDARY
      }
    ]);
  });

  it('ignores incomplete observed message events', () => {
    expect(
      coverageIntervalsFromTelegramMessagesObserved({
        data: {
          chat: {
            _model: 'telegram.chat',
            id: 'chat-a'
          },
          interval: {
            endAt: '2026-05-05T00:10:00.000Z',
            startAt: null
          },
          reachedStart: false
        },
        id: 'evt_test',
        occurredAt: '2026-05-05T00:10:00.000Z',
        type: 'telegram.messages.observed'
      })
    ).toEqual([]);
  });
});
