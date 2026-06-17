import { describe, expect, it } from 'vitest';

import type { Message } from '../../../src/domain/models/message.js';
import { buildLiveItems } from './liveMessages.js';

describe('live messages', () => {
  it('builds live message rows with chat labels', () => {
    const items = buildLiveItems(
      [
        message({
          chatId: '2',
          date: '2026-06-16T10:01:00.000Z',
          messageId: '8',
          text: 'Second'
        }),
        message({
          chatId: '1',
          date: '2026-06-16T10:00:00.000Z',
          messageId: '7',
          text: 'First'
        })
      ],
      new Map([
        ['1', { avatarUrl: '/avatars/one.png', title: 'Alpha Chat' }],
        ['2', { avatarUrl: null, title: 'Beta Chat' }]
      ])
    );

    expect(items.map((item) => item.kind)).toEqual(['date', 'message', 'message']);
    expect(items[1]).toMatchObject({
      chatAvatarUrl: '/avatars/one.png',
      chatId: '1',
      chatTitle: 'Alpha Chat',
      kind: 'message'
    });
    expect(items[2]).toMatchObject({
      chatAvatarUrl: null,
      chatId: '2',
      chatTitle: 'Beta Chat',
      kind: 'message'
    });
  });

  it('resolves replies inside the target chat', () => {
    const items = buildLiveItems(
      [
        message({
          chatId: '1',
          date: '2026-06-16T10:00:00.000Z',
          messageId: '10',
          text: 'Same chat target'
        }),
        message({
          chatId: '2',
          date: '2026-06-16T10:01:00.000Z',
          messageId: '10',
          text: 'Other chat target'
        }),
        message({
          chatId: '1',
          date: '2026-06-16T10:02:00.000Z',
          messageId: '11',
          replyToMessageId: '10',
          text: 'Reply'
        })
      ],
      new Map([['1', { avatarUrl: null, title: 'Alpha Chat' }]])
    );

    const reply = items.find((item) => item.kind === 'message' && item.message.id === '1:11');
    expect(reply).toMatchObject({
      kind: 'message',
      view: {
        isReplyLoaded: true,
        replyText: 'Same chat target'
      }
    });
  });
});

function message(input: {
  chatId: string;
  date: string;
  messageId: string;
  replyToMessageId?: string;
  text: string;
}): Message {
  return {
    _model: 'telegram.message',
    chat: {
      _model: 'telegram.chat',
      id: input.chatId
    },
    contentType: 'messageText',
    deletedAt: null,
    editDate: null,
    id: `${input.chatId}:${input.messageId}`,
    isDeleted: false,
    isOutgoing: false,
    media: {
      files: []
    },
    messageDate: input.date,
    reactions: [],
    replyTo:
      input.replyToMessageId === undefined
        ? null
        : {
            chat: {
              _model: 'telegram.chat',
              id: input.chatId
            },
            message: {
              _model: 'telegram.message',
              id: `${input.chatId}:${input.replyToMessageId}`
            },
            telegramMessageId: input.replyToMessageId
          },
    sender: null,
    senderDisplayName: null,
    senderType: null,
    serviceAction: null,
    telegramMessageId: input.messageId,
    text: input.text,
    textEntities: []
  };
}
