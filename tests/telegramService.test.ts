import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app/createApp.js';
import type { AppEvent } from '../src/bus/events.js';

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
});
