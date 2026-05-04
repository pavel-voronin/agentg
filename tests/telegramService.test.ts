import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app/createApp.js';
import type { AppEvent } from '../src/bus/events.js';
import type { TelegramTdlibClient } from '../src/telegram/tdlibClient.js';

describe('TelegramService', () => {
  it('ingests TDLib updates and returns DTOs without raw TDLib leakage', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'agentg-telegram-'));
    const app = createApp({
      cwd,
      env: {
        AGENTG_SQLITE_PATH: './telegram.sqlite'
      }
    });
    const received: AppEvent[] = [];

    app.eventBus.subscribe('telegram.message.created', (event) => {
      received.push(event);
    });

    try {
      await app.services.telegram.ingestUpdate({
        _: 'updateNewChat',
        chat: {
          _: 'chat',
          id: 1001,
          title: 'Ops',
          type: {
            _: 'chatTypeSupergroup',
            is_channel: false
          }
        }
      });

      await app.services.telegram.ingestUpdate({
        _: 'updateNewMessage',
        message: {
          _: 'message',
          chat_id: 1001,
          content: {
            _: 'messageText',
            text: {
              _: 'formattedText',
              text: 'hello'
            }
          },
          date: 1_700_000_000,
          id: 9001,
          sender_id: {
            _: 'messageSenderUser',
            user_id: 501
          }
        }
      });

      const chat = await app.services.telegram.getChat('1001');
      const message = await app.services.telegram.getMessage('1001', '9001');

      expect(chat).toEqual({
        id: '1001',
        title: 'Ops',
        type: 'group',
        updatedAt: expect.any(String) as string
      });
      expect(message).toEqual({
        chatId: '1001',
        contentType: 'messageText',
        isDeleted: false,
        messageDate: '2023-11-14T22:13:20.000Z',
        messageId: '9001',
        senderId: '501',
        senderType: 'messageSenderUser',
        text: 'hello',
        updatedAt: expect.any(String) as string
      });
      expect(JSON.stringify(message)).not.toContain('raw');
      expect(JSON.stringify(message)).not.toContain('chat_id');
      expect(message).not.toHaveProperty('_');
      expect(received).toHaveLength(1);
    } finally {
      await app.stop();
    }
  });

  it('lists chats by Telegram chat folders', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'agentg-telegram-folders-'));
    const app = createApp({
      cwd,
      env: {
        AGENTG_SQLITE_PATH: './telegram-folders.sqlite'
      }
    });
    const chatListEvents: AppEvent[] = [];

    app.eventBus.subscribe('telegram.chat_list.updated', (event) => {
      chatListEvents.push(event);
    });

    try {
      await app.services.telegram.ingestUpdate({
        _: 'updateChatFolders',
        chat_folders: [
          {
            _: 'chatFolderInfo',
            id: 7,
            name: {
              _: 'chatFolderName',
              text: {
                _: 'formattedText',
                text: 'Work'
              }
            }
          }
        ]
      });
      await app.services.telegram.ingestUpdate({
        _: 'updateNewChat',
        chat: {
          _: 'chat',
          id: 2001,
          title: 'Folder Chat',
          type: {
            _: 'chatTypePrivate',
            user_id: 2001
          }
        }
      });
      await app.services.telegram.ingestUpdate({
        _: 'updateChatAddedToList',
        chat_id: 2001,
        chat_list: {
          _: 'chatListFolder',
          chat_folder_id: 7
        }
      });
      await app.services.telegram.ingestUpdate({
        _: 'updateChatAddedToList',
        chat_id: 2001,
        chat_list: {
          _: 'chatListMain'
        }
      });

      expect(app.services.telegram.listChatFolders()).toEqual([
        {
          count: 1,
          iconName: null,
          id: 7,
          position: 0,
          title: 'Work'
        }
      ]);
      expect(app.services.history.listChats({ folderId: 7, list: 'folder' }).chats).toEqual([
        expect.objectContaining({
          id: '2001',
          title: 'Folder Chat'
        })
      ]);
      expect(app.services.history.listChats({ list: 'main' }).chats).toEqual([
        expect.objectContaining({
          id: '2001'
        })
      ]);
      expect(chatListEvents).toHaveLength(2);
    } finally {
      await app.stop();
    }
  });

  it('lists chats by TDLib chat list order', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'agentg-telegram-order-'));
    const app = createApp({
      cwd,
      env: {
        AGENTG_SQLITE_PATH: './telegram-order.sqlite'
      }
    });

    try {
      await app.services.telegram.ingestUpdate(
        telegramChatWithPositions('3001', 'Low', {
          folder: '9221294784512000001',
          main: '9221294784512000001'
        })
      );
      await app.services.telegram.ingestUpdate(
        telegramChatWithPositions('3002', 'High', {
          folder: '9221294784512000003',
          main: '9221294784512000003'
        })
      );
      await app.services.telegram.ingestUpdate(
        telegramChatWithPositions('3003', 'Middle', {
          folder: '9221294784512000002',
          main: '9221294784512000002'
        })
      );

      expect(app.services.history.listChats({ list: 'main' }).chats.map((chat) => chat.id)).toEqual(
        ['3002', '3003', '3001']
      );
      expect(
        app.services.history
          .listChats({
            folderId: 7,
            list: 'folder'
          })
          .chats.map((chat) => chat.id)
      ).toEqual(['3002', '3003', '3001']);

      await app.services.telegram.ingestUpdate({
        _: 'updateChatPosition',
        chat_id: 3001,
        position: {
          _: 'chatPosition',
          list: {
            _: 'chatListMain'
          },
          order: '9221294784512000004'
        }
      });
      await app.services.telegram.ingestUpdate({
        _: 'updateChatPosition',
        chat_id: 3002,
        position: {
          _: 'chatPosition',
          list: {
            _: 'chatListMain'
          },
          order: '0'
        }
      });

      expect(app.services.history.listChats({ list: 'main' }).chats.map((chat) => chat.id)).toEqual(
        ['3001', '3003']
      );
    } finally {
      await app.stop();
    }
  });

  it('uses private user names when TDLib chat title is empty', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'agentg-telegram-names-'));
    const app = createApp({
      cwd,
      env: {
        AGENTG_SQLITE_PATH: './telegram-names.sqlite'
      }
    });

    try {
      await app.services.telegram.ingestUpdate({
        _: 'updateNewChat',
        chat: {
          _: 'chat',
          id: 149725525,
          title: '',
          type: {
            _: 'chatTypePrivate',
            user_id: 149725525
          }
        }
      });
      await app.services.telegram.ingestUpdate({
        _: 'updateUser',
        user: {
          _: 'user',
          first_name: 'Ivan',
          id: 149725525,
          last_name: 'Petrov',
          type: {
            _: 'userTypeRegular'
          }
        }
      });

      await expect(app.services.telegram.getChat('149725525')).resolves.toEqual({
        id: '149725525',
        title: 'Ivan Petrov',
        type: 'private',
        updatedAt: expect.any(String) as string
      });
      expect(app.services.history.listChats({ query: 'Ivan' }).chats).toEqual([
        expect.objectContaining({
          id: '149725525',
          title: 'Ivan Petrov'
        })
      ]);
    } finally {
      await app.stop();
    }
  });

  it('hydrates an already stored private chat when its title fell back to id', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'agentg-telegram-hydrate-name-'));
    const app = createApp({
      cwd,
      env: {
        AGENTG_SQLITE_PATH: './telegram-hydrate-name.sqlite'
      }
    });

    try {
      await app.services.telegram.ingestUpdate({
        _: 'updateNewChat',
        chat: {
          _: 'chat',
          id: 149725525,
          title: '',
          type: {
            _: 'chatTypePrivate',
            user_id: 149725525
          }
        }
      });

      await expect(app.services.telegram.getChat('149725525')).resolves.toMatchObject({
        title: 'Unknown User'
      });

      app.services.telegram.setTdlibClient(createPrivateNameTdlibClient());

      await expect(app.services.telegram.getChat('149725525')).resolves.toMatchObject({
        id: '149725525',
        title: 'Ivan Petrov',
        type: 'private'
      });
    } finally {
      await app.stop();
    }
  });

  it('shows a human fallback for deleted private users without leaking numeric ids as names', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'agentg-telegram-deleted-name-'));
    const app = createApp({
      cwd,
      env: {
        AGENTG_SQLITE_PATH: './telegram-deleted-name.sqlite'
      }
    });

    try {
      await app.services.telegram.ingestUpdate({
        _: 'updateNewChat',
        chat: {
          _: 'chat',
          id: 149725525,
          title: '',
          type: {
            _: 'chatTypePrivate',
            user_id: 149725525
          }
        }
      });
      await app.services.telegram.ingestUpdate({
        _: 'updateUser',
        user: {
          _: 'user',
          first_name: '',
          id: 149725525,
          last_name: '',
          type: {
            _: 'userTypeDeleted'
          }
        }
      });

      await expect(app.services.telegram.getChat('149725525')).resolves.toMatchObject({
        id: '149725525',
        title: 'Deleted Account',
        type: 'private'
      });
    } finally {
      await app.stop();
    }
  });
});

function createPrivateNameTdlibClient(): TelegramTdlibClient {
  return {
    close: () => Promise.resolve(),
    getChat: () =>
      Promise.resolve({
        _: 'chat',
        id: 149725525,
        title: '',
        type: {
          _: 'chatTypePrivate',
          user_id: 149725525
        }
      }),
    getChatHistory: () => Promise.resolve({ _: 'messages', messages: [] }),
    getChatMessageByDate: () => Promise.resolve(undefined),
    getChats: () => Promise.resolve({ _: 'chats', chat_ids: [] }),
    getMessage: () => Promise.resolve(undefined),
    getUser: () =>
      Promise.resolve({
        _: 'user',
        first_name: 'Ivan',
        id: 149725525,
        last_name: 'Petrov',
        type: {
          _: 'userTypeRegular'
        }
      }),
    loadChats: () => Promise.resolve(),
    login: () => Promise.resolve(),
    onError: () => ({
      unsubscribe() {
        return;
      }
    }),
    onUpdate: () => ({
      unsubscribe() {
        return;
      }
    })
  };
}

function telegramChatWithPositions(
  id: string,
  title: string,
  orders: {
    folder: string;
    main: string;
  }
): unknown {
  return {
    _: 'updateNewChat',
    chat: {
      _: 'chat',
      id: Number(id),
      positions: [
        {
          _: 'chatPosition',
          list: {
            _: 'chatListMain'
          },
          order: orders.main
        },
        {
          _: 'chatPosition',
          list: {
            _: 'chatListFolder',
            chat_folder_id: 7
          },
          order: orders.folder
        }
      ],
      title,
      type: {
        _: 'chatTypeSupergroup',
        is_channel: false
      }
    }
  };
}
