import { describe, expect, it, vi } from 'vitest';

import type { TelegramDatabase } from '../src/database.js';
import { createTelegramRouter } from '../src/rpc/router.js';
import { toTelegramChatStorageRow } from '../src/telegram-read-model/chat.js';
import { toDirectoryEntries } from '../src/telegram-read-model/directory.js';
import type { TelegramFileSubsystem } from '../src/telegramFileSubsystem.js';

describe('Telegram history router chat listing', () => {
  it('filters chats without TDLib list placements from the chat directory', async () => {
    const visible = chatRow({
      id: 'chat-visible',
      title: 'Visible',
      type: 'group'
    });
    const orphan = chatRow({
      id: 'chat-orphan',
      title: 'Orphan',
      type: 'channel'
    });
    const database = createFakeDatabase([
      [visible, orphan],
      [visible, orphan],
      [],
      [positionRow('chat-visible', 'main', '100')],
      [],
      [positionRow('chat-visible', 'main', '100')],
      []
    ]);
    const caller = createCaller(database);

    await expect(caller.listChatDirectory({})).resolves.toMatchObject({
      chats: [
        {
          id: 'chat-visible',
          placements: [{ kind: 'main', order: '100' }]
        }
      ],
      navigationChats: [
        {
          id: 'chat-visible'
        }
      ],
      types: [{ count: 1, type: 'group' }]
    });
  });

  it('loads directory last messages in one batch for the chat set', async () => {
    const database = createFakeDatabase([
      [messageRow('20', '10', 'latest'), messageRow('21', '11', 'newer')],
      [],
      [positionRow('20', 'main', '100'), positionRow('21', 'main', '90')],
      []
    ]);

    const entries = await toDirectoryEntries(database as unknown as TelegramDatabase, [
      toTelegramChatStorageRow({
        lastMessageId: '10',
        telegramChatId: '20',
        title: 'First',
        type: { _: 'chatTypeSupergroup', is_channel: false },
        unreadCount: 0
      }),
      toTelegramChatStorageRow({
        lastMessageId: '11',
        telegramChatId: '21',
        title: 'Second',
        type: { _: 'chatTypeSupergroup', is_channel: false },
        unreadCount: 0
      })
    ]);

    expect(entries).toMatchObject([
      {
        id: '20',
        lastMessage: {
          text: 'latest'
        }
      },
      {
        id: '21',
        lastMessage: {
          text: 'newer'
        }
      }
    ]);
    expect(database.selectCalls()).toBe(4);
  });

  it('filters chats without TDLib list placements from history discovery inputs', async () => {
    const database = createFakeDatabase([
      [
        chatRow({
          id: 'chat-visible',
          title: 'Visible',
          type: 'channel'
        }),
        chatRow({
          id: 'chat-orphan',
          title: 'Orphan',
          type: 'channel'
        })
      ],
      [positionRow('chat-visible', 'archive', '200')],
      []
    ]);
    const caller = createCaller(database);

    await expect(caller.listChats({ discover: false })).resolves.toEqual([
      {
        _model: 'telegram.chat',
        id: 'chat-visible',
        title: 'Visible',
        type: 'channel'
      }
    ]);
  });

  it('returns unavailable history facts for chats without TDLib list placements', async () => {
    const database = createFakeDatabase([
      [
        chatRow({
          id: 'chat-orphan',
          title: 'Orphan',
          type: 'channel'
        })
      ]
    ]);
    const caller = createCaller(database);

    await expect(caller.getChatHistoryFacts({ chatId: 'chat-orphan' })).resolves.toEqual({
      chat: null,
      earliestMessageDate: null,
      messageCount: 0
    });
    expect(database.selectCalls()).toBe(3);
  });

  it('anchors the first message page from stored chat last_message_id', async () => {
    const database = createFakeDatabase([
      [{ lastMessageId: '10' }],
      [{ messageDate: new Date('2024-01-01T00:00:10Z') }],
      [],
      [{ count: 2 }],
      [messageRow('20', '10', 'latest'), messageRow('20', '9', 'older')],
      []
    ]);
    const client = {
      invoke: vi.fn((request: Record<string, unknown>) => {
        if (request._ !== 'getChatHistory') {
          throw new Error(`unexpected TDLib call: ${String(request._)}`);
        }
        return Promise.resolve({
          _: 'messages',
          messages: [tdlibTextMessage('20', '9', 'older', 1_704_067_209)]
        });
      })
    };
    const caller = createCaller(database, { client });

    await expect(caller.fetchMessagesPage({ chatId: '20', limit: 50 })).resolves.toMatchObject({
      messages: [
        { telegramMessageId: '10', text: 'latest' },
        { telegramMessageId: '9', text: 'older' }
      ]
    });

    expect(client.invoke).toHaveBeenCalledTimes(1);
    expect(client.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        _: 'getChatHistory',
        chat_id: 20,
        from_message_id: 10,
        limit: 50,
        offset: 0,
        only_local: false
      }),
      expect.any(Object)
    );
  });

  it('returns a message page before operator page file recording completes', async () => {
    const database = createFakeDatabase([
      [{ lastMessageId: '10' }],
      [{ messageDate: new Date('2024-01-01T00:00:10Z') }],
      [],
      [{ count: 1 }],
      [messageRow('20', '9', 'older')],
      []
    ]);
    const client = {
      invoke: vi.fn(() =>
        Promise.resolve({
          _: 'messages',
          messages: [tdlibTextMessage('20', '9', 'older', 1_704_067_209)]
        })
      )
    };
    const recordMessageFiles = vi.fn(() => delay(100));
    const caller = createCaller(database, {
      client,
      files: {
        recordMessageFiles
      }
    });

    const result = await Promise.race([
      caller.fetchMessagesPage({ chatId: '20', limit: 50 }).then(() => 'resolved'),
      delay(50).then(() => 'timeout')
    ]);

    expect(result).toBe('resolved');
    await nextImmediate();
    expect(recordMessageFiles).toHaveBeenCalledTimes(1);
  });
});

function createCaller(
  database: ReturnType<typeof createFakeDatabase>,
  options: {
    client?: { invoke(request: Record<string, unknown>, options?: unknown): Promise<unknown> };
    files?: Partial<TelegramFileSubsystem>;
  } = {}
) {
  const files: TelegramFileSubsystem = {
    close() {
      return;
    },
    getQueueStats() {
      return Promise.resolve({}) as never;
    },
    handleUpdateFile() {
      return Promise.resolve();
    },
    startFileGeneration() {
      return;
    },
    stopFileGeneration() {
      return Promise.resolve();
    },
    recordChatBackgroundFiles() {
      return Promise.resolve();
    },
    recordChatFiles() {
      return Promise.resolve();
    },
    recordChatPhotoFiles() {
      return Promise.resolve();
    },
    recordChatThemeFiles() {
      return Promise.resolve();
    },
    recordDefaultBackgroundFiles() {
      return Promise.resolve();
    },
    recordEmojiChatThemeFiles() {
      return Promise.resolve();
    },
    recordMessageContentFiles() {
      return Promise.resolve();
    },
    recordMessageFiles() {
      return Promise.resolve();
    },
    recordNotificationGroupFiles() {
      return Promise.resolve();
    },
    recordNotificationFiles() {
      return Promise.resolve();
    },
    recordQuickReplyMessageFiles() {
      return Promise.resolve();
    },
    recordStickerSetFiles() {
      return Promise.resolve();
    },
    recordStoryFiles() {
      return Promise.resolve();
    },
    recordTrendingStickerSetFiles() {
      return Promise.resolve();
    },
    recordUserFullInfoFiles() {
      return Promise.resolve();
    },
    deleteStoryFileSlots() {
      return Promise.resolve();
    },
    requestFile() {
      return Promise.resolve({}) as never;
    },
    ...options.files
  };

  return createTelegramRouter({
    client: options.client ?? { invoke: vi.fn() },
    database: database as unknown as TelegramDatabase,
    eventBus: { publish: vi.fn() } as never,
    files
  }).createCaller({});
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function nextImmediate(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function createFakeDatabase(results: unknown[][]) {
  let selectCallCount = 0;
  const returning = vi.fn(() => Promise.resolve([{ telegramMessageId: 'stored' }]));
  const writeQuery = {
    onConflictDoNothing: vi.fn(() => ({ returning })),
    onConflictDoUpdate: vi.fn(() => ({ returning })),
    returning
  };
  const values = vi.fn(() => writeQuery);
  const insert = vi.fn(() => ({ values }));
  const where = vi.fn(() => Promise.resolve([]));
  const deleteRows = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({
    set: vi.fn(() => ({ where }))
  }));
  const database = {
    delete: deleteRows,
    insert,
    select(): unknown {
      const result = results[selectCallCount] ?? [];
      selectCallCount += 1;
      return thenableQuery(result);
    },
    selectCalls(): number {
      return selectCallCount;
    },
    transaction(callback: (transaction: unknown) => unknown) {
      return Promise.resolve(callback(database));
    },
    update
  };
  return database;
}

function thenableQuery(result: unknown[]) {
  const query = {
    from() {
      return query;
    },
    groupBy() {
      return query;
    },
    innerJoin() {
      return query;
    },
    leftJoin() {
      return query;
    },
    limit() {
      return query;
    },
    orderBy() {
      return query;
    },
    then(resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve(result).then(resolve, reject);
    },
    where() {
      return query;
    }
  };
  return query;
}

function messageRow(chatId: string, messageId: string, text: string) {
  return {
    contentType: 'messageText',
    deletedAt: null,
    editDate: null,
    isDeleted: false,
    isOutgoing: false,
    messageDate: new Date('2024-01-01T00:00:00Z'),
    replyTo: null,
    senderId: null,
    senderType: null,
    telegramChatId: chatId,
    telegramMessageId: messageId,
    text
  };
}

function positionRow(chatId: string, listKey: string, order: string) {
  return {
    chatId,
    isPinned: false,
    listKey,
    order
  };
}

function tdlibTextMessage(chatId: string, messageId: string, text: string, date: number) {
  return {
    _: 'message',
    author_signature: '',
    auto_delete_in: 0,
    can_be_saved: true,
    chat_id: Number(chatId),
    contains_unread_mention: false,
    content: {
      _: 'messageText',
      text: {
        _: 'formattedText',
        entities: [],
        text
      }
    },
    date,
    edit_date: 0,
    effect_id: '0',
    has_timestamped_media: false,
    id: Number(messageId),
    is_channel_post: false,
    is_from_offline: false,
    is_outgoing: false,
    is_paid_star_suggested_post: false,
    is_paid_ton_suggested_post: false,
    is_pinned: false,
    media_album_id: '0',
    paid_message_star_count: 0,
    sender_boost_count: 0,
    sender_business_bot_user_id: 0,
    sender_id: {
      _: 'messageSenderUser',
      user_id: 30
    },
    sender_tag: '',
    self_destruct_in: 0,
    summary_language_code: '',
    unread_reactions: [],
    via_bot_user_id: 0
  };
}

function chatRow(input: { id: string; title: string; type: string }) {
  const type = chatType(input.type);
  return {
    id: input.id,
    telegramChatId: input.id,
    title: input.title,
    type,
    unreadCount: 0
  };
}

function chatType(type: string) {
  if (type === 'private') {
    return { _: 'chatTypePrivate' };
  }
  if (type === 'secret') {
    return { _: 'chatTypeSecret' };
  }
  if (type === 'group') {
    return { _: 'chatTypeSupergroup', is_channel: false };
  }
  if (type === 'channel') {
    return { _: 'chatTypeSupergroup', is_channel: true };
  }
  return { _: type };
}
