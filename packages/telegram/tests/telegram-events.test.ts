import { createTelegramIntegrationEvents } from '@agentg/telegram/integration-events';
import { describe, expect, it } from 'vitest';

describe('Telegram integration events', () => {
  it('publishes Telegram domain objects as ModelRefs', () => {
    const events = createTelegramIntegrationEvents(
      {
        chat: {
          id: 'chat-a',
          title: 'Chat A',
          type: 'group'
        },
        chatFolders: {
          folders: [
            {
              iconName: 'Work',
              id: 4,
              position: 1,
              title: 'Work'
            }
          ]
        },
        message: {
          chatId: 'chat-a',
          contentType: 'messageText',
          messageDate: new Date('2026-05-05T00:00:00.000Z'),
          messageId: '42',
          senderId: 'user-a',
          senderType: 'messageSenderUser',
          text: 'hello'
        },
        user: {
          firstName: 'Alice',
          id: 'user-a',
          isBot: false,
          lastName: '',
          username: 'alice'
        }
      },
      {
        chat: true,
        chatFolders: true,
        message: true,
        user: true
      }
    );

    expect(events).toMatchObject([
      {
        data: {
          chat: {
            _model: 'telegram.chat',
            id: 'chat-a',
            title: 'Chat A',
            type: 'group'
          }
        },
        meta: {
          chatId: 'chat-a'
        },
        type: 'telegram.chat.updated'
      },
      {
        data: {
          folders: [
            {
              _model: 'telegram.chatFolder',
              iconName: 'Work',
              id: '4',
              position: 1,
              title: 'Work'
            }
          ]
        },
        type: 'telegram.chat_folders.updated'
      },
      {
        data: {
          message: {
            _model: 'telegram.message',
            chat: {
              _model: 'telegram.chat',
              id: 'chat-a'
            },
            id: 'chat-a:42',
            sender: {
              _model: 'telegram.user',
              id: 'user-a'
            },
            telegramMessageId: '42'
          }
        },
        meta: {
          chatId: 'chat-a',
          messageId: '42'
        },
        occurredAt: '2026-05-05T00:00:00.000Z',
        type: 'telegram.message.created'
      },
      {
        data: {
          user: {
            _model: 'telegram.user',
            id: 'user-a',
            username: 'alice'
          }
        },
        meta: {
          userId: 'user-a'
        },
        type: 'telegram.user.updated'
      }
    ]);
  });

  it('publishes delete payloads as message ModelRefs', () => {
    const [event] = createTelegramIntegrationEvents(
      {
        delete: {
          chatId: 'chat-a',
          deletedAt: new Date('2026-05-05T00:00:00.000Z'),
          fromCache: false,
          isPermanent: true,
          messageIds: ['42', '43']
        }
      },
      {
        chat: false,
        chatFolders: false,
        message: true,
        user: false
      }
    );

    expect(event).toMatchObject({
      data: {
        delete: {
          chat: {
            _model: 'telegram.chat',
            id: 'chat-a'
          },
          messages: [
            {
              _model: 'telegram.message',
              id: 'chat-a:42'
            },
            {
              _model: 'telegram.message',
              id: 'chat-a:43'
            }
          ]
        }
      },
      type: 'telegram.message.deleted'
    });
  });
});
