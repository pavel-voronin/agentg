import { describe, expect, it } from 'vitest';

import { normalizeTelegramUpdate } from '@agentg/telegram/normalize';

describe('normalizeTelegramUpdate', () => {
  it('normalizes new text messages', () => {
    const normalized = normalizeTelegramUpdate({
      _: 'updateNewMessage',
      message: {
        _: 'message',
        chat_id: -100,
        content: {
          _: 'messageText',
          text: {
            _: 'formattedText',
            entities: [],
            text: 'hello'
          }
        },
        date: 1777130000,
        id: 42,
        sender_id: {
          _: 'messageSenderUser',
          user_id: 927300
        }
      }
    });

    expect(normalized?.event).toMatchObject({
      eventType: 'message_created',
      tdlibUpdateType: 'updateNewMessage',
      telegramChatId: '-100',
      telegramMessageId: '42'
    });
    expect(normalized?.message).toMatchObject({
      chatId: '-100',
      contentType: 'messageText',
      messageId: '42',
      senderId: '927300',
      senderType: 'messageSenderUser',
      text: 'hello'
    });
  });

  it('normalizes message content updates', () => {
    const normalized = normalizeTelegramUpdate({
      _: 'updateMessageContent',
      chat_id: -100,
      edit_date: 1777130100,
      message_id: 42,
      new_content: {
        _: 'messageText',
        text: {
          _: 'formattedText',
          entities: [],
          text: 'edited'
        }
      }
    });

    expect(normalized?.event).toMatchObject({
      eventType: 'message_content_updated',
      telegramChatId: '-100',
      telegramMessageId: '42'
    });
    expect(normalized?.contentUpdate).toMatchObject({
      chatId: '-100',
      contentType: 'messageText',
      messageId: '42',
      text: 'edited'
    });
  });

  it('normalizes deleted messages', () => {
    const normalized = normalizeTelegramUpdate({
      _: 'updateDeleteMessages',
      chat_id: -100,
      from_cache: false,
      is_permanent: true,
      message_ids: [42, 43]
    });

    expect(normalized?.event).toMatchObject({
      eventType: 'messages_deleted',
      telegramChatId: '-100',
      telegramMessageId: '42'
    });
    expect(normalized?.delete).toMatchObject({
      chatId: '-100',
      fromCache: false,
      isPermanent: true,
      messageIds: ['42', '43']
    });
  });

  it('preserves cache-only delete metadata for raw events', () => {
    const normalized = normalizeTelegramUpdate({
      _: 'updateDeleteMessages',
      chat_id: -100,
      from_cache: true,
      is_permanent: false,
      message_ids: [42]
    });

    expect(normalized?.event).toMatchObject({
      eventType: 'messages_deleted',
      telegramChatId: '-100',
      telegramMessageId: '42'
    });
    expect(normalized?.delete).toMatchObject({
      chatId: '-100',
      fromCache: true,
      isPermanent: false,
      messageIds: ['42']
    });
  });
});
