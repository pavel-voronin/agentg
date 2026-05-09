import {
  createTelegramIntegrationEvents,
  createTelegramMessagesObservedEvent
} from '@agentg/telegram/integration-events';
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
          isOutgoing: false,
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
      },
      {
        chatDirectoryEvent: {
          chat: {
            _model: 'telegram.chat',
            id: 'chat-a',
            isBot: false,
            isSelf: false,
            lastMessageDate: 1777777777,
            placements: [{ kind: 'main', order: '100' }],
            title: 'Chat A',
            type: 'group',
            updatedAt: '2026-05-05T00:00:00.000Z'
          },
          kind: 'updated'
        }
      }
    );

    expect(events).toMatchObject([
      {
        data: {
          chat: {
            _model: 'telegram.chat',
            id: 'chat-a',
            isBot: false,
            isSelf: false,
            lastMessageDate: 1777777777,
            placements: [{ kind: 'main', order: '100' }],
            title: 'Chat A',
            type: 'group',
            updatedAt: '2026-05-05T00:00:00.000Z'
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
              folderId: 4,
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

  it('publishes message service actions with user ModelRefs', () => {
    const [event] = createTelegramIntegrationEvents(
      {
        message: {
          chatId: 'chat-a',
          contentType: 'messageChatDeleteMember',
          isOutgoing: false,
          messageId: '42',
          serviceAction: {
            kind: 'chatMemberLeft',
            userDisplayName: 'Pavel',
            userId: 'user-a'
          }
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
        message: {
          serviceAction: {
            kind: 'chatMemberLeft',
            user: {
              _model: 'telegram.user',
              id: 'user-a'
            },
            userDisplayName: 'Pavel'
          }
        }
      },
      type: 'telegram.message.created'
    });
  });

  it('publishes removed chat directory events separately from folders', () => {
    const events = createTelegramIntegrationEvents(
      {
        chat: {
          id: 'chat-a',
          title: 'Chat A',
          type: 'group'
        }
      },
      {
        chat: false,
        chatFolders: false,
        message: false,
        user: false
      },
      {
        chatDirectoryEvent: {
          chatId: 'chat-a',
          kind: 'removed'
        }
      }
    );

    expect(events).toMatchObject([
      {
        data: {
          chatId: 'chat-a'
        },
        meta: {
          chatId: 'chat-a'
        },
        type: 'telegram.chat.removed'
      }
    ]);
  });

  it('publishes observed message page intervals as Telegram facts', () => {
    const event = createTelegramMessagesObservedEvent({
      chatId: 'chat-a',
      endAt: new Date('2026-05-05T00:10:00.000Z'),
      fetchedMessages: 25,
      reachedStart: false,
      startAt: new Date('2026-05-05T00:00:00.000Z'),
      storedMessages: 25
    });

    expect(event).toMatchObject({
      data: {
        chat: {
          _model: 'telegram.chat',
          id: 'chat-a'
        },
        fetchedMessages: 25,
        interval: {
          endAt: '2026-05-05T00:10:00.000Z',
          startAt: '2026-05-05T00:00:00.000Z'
        },
        reachedStart: false,
        storedMessages: 25
      },
      meta: {
        chatId: 'chat-a'
      },
      type: 'telegram.messages.observed'
    });
  });
});
