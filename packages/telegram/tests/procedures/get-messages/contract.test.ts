import { describe, expect, it } from 'vitest';

import { getMessagesInputSchema } from '../../../src/procedures/get-messages/contract.js';

describe('Telegram getMessages contract', () => {
  it('canonicalizes TDLib ids at the public boundary', () => {
    const input = getMessagesInputSchema.parse({
      owner: {
        chatId: '00123',
        kind: 'chat'
      },
      selector: {
        beforeMessageId: '000456',
        count: 100,
        kind: 'page'
      }
    });

    expect(input).toEqual({
      owner: {
        chatId: '123',
        kind: 'chat'
      },
      selector: {
        beforeMessageId: '456',
        count: 100,
        kind: 'page'
      }
    });
  });

  it('rejects forum topic ids outside TDLib int32 range', () => {
    expect(() =>
      getMessagesInputSchema.parse({
        owner: {
          chatId: '123',
          kind: 'forumTopic',
          topicId: '2147483648'
        },
        selector: {
          count: 100,
          kind: 'page'
        }
      })
    ).toThrow();
  });

  it('rejects zero message anchors', () => {
    expect(() =>
      getMessagesInputSchema.parse({
        owner: {
          chatId: '123',
          kind: 'chat'
        },
        selector: {
          beforeMessageId: '0',
          count: 100,
          kind: 'page'
        }
      })
    ).toThrow();
  });

  it('rejects zero thread root message ids', () => {
    expect(() =>
      getMessagesInputSchema.parse({
        owner: {
          chatId: '123',
          kind: 'messageThread',
          messageId: '0'
        },
        selector: {
          count: 100,
          kind: 'page'
        }
      })
    ).toThrow();
  });
});
