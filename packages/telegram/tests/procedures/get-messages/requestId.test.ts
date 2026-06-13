import { describe, expect, it } from 'vitest';

import { getMessagesInputSchema } from '../../../src/procedures/get-messages/contract.js';
import { getMessagesRequestId } from '../../../src/procedures/get-messages/requestId.js';

describe('Telegram getMessages request id', () => {
  it('builds deterministic readable page ids', () => {
    expect(
      getMessagesRequestId({
        owner: {
          chatId: '-100123',
          kind: 'chat'
        },
        selector: {
          count: 100,
          kind: 'page'
        }
      })
    ).toBe('telegram.getMessages;selector=page;owner=chat:-100123;anchor=latest;count=100');

    expect(
      getMessagesRequestId({
        owner: {
          chatId: '-100123',
          kind: 'chat'
        },
        selector: {
          beforeMessageId: '123456',
          count: 100,
          kind: 'page'
        }
      })
    ).toBe(
      'telegram.getMessages;selector=page;owner=chat:-100123;beforeMessageId=123456;count=100'
    );
  });

  it('builds deterministic readable range ids for topic owners', () => {
    expect(
      getMessagesRequestId({
        owner: {
          chatId: '-100123',
          kind: 'forumTopic',
          topicId: '7'
        },
        selector: {
          endAt: '2026-02-01T00:00:00.000Z',
          kind: 'range',
          startAt: '2026-01-01T00:00:00.000Z'
        }
      })
    ).toBe(
      'telegram.getMessages;selector=range;owner=forum-topic:-100123:7;startAt=2026-01-01T00:00:00.000Z;endAt=2026-02-01T00:00:00.000Z'
    );
  });

  it('escapes field separators without hashing the id', () => {
    expect(
      getMessagesRequestId({
        owner: {
          kind: 'savedMessagesTopic',
          topicId: '42'
        },
        selector: {
          endAt: '2026-02-01T00:00:00.000Z',
          kind: 'range',
          startAt: '2026-01-01T00:00:00.000Z'
        }
      })
    ).toContain('owner=saved-messages-topic:42');
  });

  it('uses canonical ids from the public contract parser', () => {
    expect(
      getMessagesRequestId(
        getMessagesInputSchema.parse({
          owner: {
            chatId: '00123',
            kind: 'chat'
          },
          selector: {
            beforeMessageId: '000456',
            count: 100,
            kind: 'page'
          }
        })
      )
    ).toBe('telegram.getMessages;selector=page;owner=chat:123;beforeMessageId=456;count=100');
  });
});
