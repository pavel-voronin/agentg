import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TelegramDatabase } from '../src/database.js';
import { telegramChats, telegramFileSlots, telegramMessages } from '../src/schema.js';
import type { TelegramUpdateHandlerContext } from '../src/telegram-update-runtime/context.js';
import { handleUpdateChatLastMessage } from '../src/tdlib-update-handlers/updateChatLastMessage.js';
import { handleUpdateDeleteMessages } from '../src/tdlib-update-handlers/updateDeleteMessages.js';
import { handleUpdateNewChat } from '../src/tdlib-update-handlers/updateNewChat.js';
import { handleUpdateNewMessage } from '../src/tdlib-update-handlers/updateNewMessage.js';
import type {
  TelegramWireChatLastMessageUpdate,
  TelegramWireDeleteMessagesUpdate,
  TelegramWireMessage,
  TelegramWireNewChatUpdate,
  TelegramWireNewMessageUpdate
} from '../src/telegramWire.js';

describe('TDLib update handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists updateNewMessage through message type operations', async () => {
    const {
      context,
      insert,
      onConflictDoNothing,
      publishTelegramMessageCreated,
      recordMessageFiles,
      recordLiveMessage,
      values
    } = createHandlerContext();
    const message = wireMessage({
      _: 'message',
      author_signature: 'channel admin',
      can_be_saved: true,
      chat_id: 20,
      content: {
        _: 'messageText',
        text: {
          _: 'formattedText',
          entities: [
            {
              _: 'textEntity',
              length: 11,
              offset: 0,
              type: {
                _: 'textEntityTypeUrl'
              }
            }
          ],
          text: 'example.com'
        }
      },
      date: 1_710_000_000,
      effect_id: 9901,
      id: 10,
      is_channel_post: true,
      is_from_offline: false,
      is_outgoing: false,
      media_album_id: '8801',
      paid_message_star_count: 5,
      sender_boost_count: 2,
      sender_id: {
        _: 'messageSenderUser',
        user_id: 30
      },
      sender_tag: 'tag',
      summary_language_code: 'en',
      topic_id: {
        _: 'messageTopicForum',
        forum_topic_id: 7
      },
      via_bot_user_id: 40
    });

    const update = wireUpdateNewMessage({
      _: 'updateNewMessage',
      message
    });
    await handleUpdateNewMessage(context, update);

    expect(insert).toHaveBeenCalledWith(telegramMessages);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        authorSignature: 'channel admin',
        canBeSaved: true,
        chatId: '20',
        content: expectObjectContaining({
          _: 'messageText'
        }),
        date: new Date(1_710_000_000 * 1000),
        effectId: '9901',
        id: '10',
        isChannelPost: true,
        isFromOffline: false,
        isOutgoing: false,
        mediaAlbumId: '8801',
        paidMessageStarCount: '5',
        senderBoostCount: 2,
        senderId: expectObjectContaining({
          _: 'messageSenderUser',
          user_id: 30
        }),
        senderTag: 'tag',
        summaryLanguageCode: 'en',
        topicId: expectObjectContaining({
          _: 'messageTopicForum',
          forum_topic_id: 7
        }),
        viaBotUserId: '40'
      })
    );
    expect(onConflictDoNothing).toHaveBeenCalledWith({
      target: [telegramMessages.chatId, telegramMessages.id]
    });
    expect(recordMessageFiles).toHaveBeenCalledWith(update.message, 'live_update');
    expect(recordLiveMessage).toHaveBeenCalledWith('20', expect.any(Date));
    expect(publishTelegramMessageCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: '20',
        contentType: 'messageText',
        isOutgoing: false,
        messageId: '10',
        text: 'example.com',
        textEntities: [
          {
            kind: 'url',
            length: 11,
            offset: 0,
            url: 'https://example.com/'
          }
        ]
      })
    );
  });

  it('does not publish side effects when updateNewMessage already exists', async () => {
    const {
      context,
      insert,
      publishTelegramMessageCreated,
      recordLiveMessage,
      recordMessageFiles
    } = createHandlerContext({ insertedRows: [] });

    const update = wireUpdateNewMessage({
      _: 'updateNewMessage',
      message: wireMessage({
        _: 'message',
        chat_id: 20,
        content: {
          _: 'messageText',
          text: {
            _: 'formattedText',
            entities: [],
            text: 'duplicate'
          }
        },
        date: 1_710_000_000,
        id: 10
      })
    });
    await handleUpdateNewMessage(context, update);

    expect(insert).toHaveBeenCalledWith(telegramMessages);
    expect(recordMessageFiles).not.toHaveBeenCalled();
    expect(recordLiveMessage).not.toHaveBeenCalled();
    expect(publishTelegramMessageCreated).not.toHaveBeenCalled();
  });

  it('persists updateNewChat last_message as a message row and chat last_message_id', async () => {
    const {
      context,
      insert,
      publishTelegramChatDirectoryUpdated,
      recordChatFiles,
      recordLiveMessage,
      recordMessageFiles,
      values
    } = createHandlerContext();
    const update = wireUpdateNewChat({
      _: 'updateNewChat',
      chat: {
        _: 'chat',
        id: 20,
        last_message: wireMessage({
          _: 'message',
          chat_id: 20,
          content: {
            _: 'messageText',
            text: {
              _: 'formattedText',
              entities: [],
              text: 'latest'
            }
          },
          date: 1_710_000_000,
          id: 10
        }),
        positions: [],
        title: 'Chat',
        type: {
          _: 'chatTypePrivate',
          user_id: 30
        }
      }
    });

    await handleUpdateNewChat(context, update);

    expect(insert).toHaveBeenCalledWith(telegramChats);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: '20',
        id: '10'
      })
    );
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '20',
        lastMessageId: '10'
      })
    );
    expect(recordChatFiles).toHaveBeenCalledWith(update.chat, 'live_update');
    expect(recordMessageFiles).toHaveBeenCalledWith(update.chat.last_message, 'live_update');
    expect(recordLiveMessage).not.toHaveBeenCalled();
    expect(publishTelegramChatDirectoryUpdated).toHaveBeenCalledWith('20');
  });

  it('persists updateChatLastMessage message and updates chat last_message_id', async () => {
    const {
      context,
      insert,
      publishTelegramChatDirectoryUpdated,
      recordLiveMessage,
      recordMessageFiles,
      values
    } = createHandlerContext();
    const update = wireUpdateChatLastMessage({
      _: 'updateChatLastMessage',
      chat_id: 20,
      last_message: wireMessage({
        _: 'message',
        chat_id: 20,
        content: {
          _: 'messageText',
          text: {
            _: 'formattedText',
            entities: [],
            text: 'latest'
          }
        },
        date: 1_710_000_000,
        id: 10
      }),
      positions: []
    });

    await handleUpdateChatLastMessage(context, update);

    expect(insert).toHaveBeenCalledWith(telegramChats);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: '20',
        id: '10'
      })
    );
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '20',
        lastMessageId: '10'
      })
    );
    expect(recordMessageFiles).toHaveBeenCalledWith(update.last_message, 'live_update');
    expect(recordLiveMessage).not.toHaveBeenCalled();
    expect(publishTelegramChatDirectoryUpdated).toHaveBeenCalledWith('20');
  });

  it('clears chat last_message_id on null updateChatLastMessage', async () => {
    const { context, recordMessageFiles, values } = createHandlerContext();
    const update = wireUpdateChatLastMessage({
      _: 'updateChatLastMessage',
      chat_id: 20,
      last_message: null,
      positions: []
    });

    await handleUpdateChatLastMessage(context, update);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '20',
        lastMessageId: null
      })
    );
    expect(recordMessageFiles).not.toHaveBeenCalled();
  });

  it('clears chat last_message_id when updateChatLastMessage omits last_message', async () => {
    const { context, recordMessageFiles, values } = createHandlerContext();
    const update = wireUpdateChatLastMessage({
      _: 'updateChatLastMessage',
      chat_id: 20,
      positions: []
    });

    await handleUpdateChatLastMessage(context, update);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '20',
        lastMessageId: null
      })
    );
    expect(recordMessageFiles).not.toHaveBeenCalled();
  });

  it('hard-deletes stored messages for permanent updateDeleteMessages', async () => {
    const { context, deleteRows, publishTelegramMessageDeleted, transaction } =
      createHandlerContext();

    const update = wireUpdateDeleteMessages({
      _: 'updateDeleteMessages',
      chat_id: 20,
      from_cache: false,
      is_permanent: true,
      message_ids: [10, 11]
    });
    await handleUpdateDeleteMessages(context, update);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(deleteRows).toHaveBeenCalledWith(telegramFileSlots);
    expect(deleteRows).toHaveBeenCalledWith(telegramMessages);
    expect(publishTelegramMessageDeleted).toHaveBeenCalledWith({
      chatId: '20',
      deletedAt: expect.any(Date) as unknown,
      fromCache: false,
      isPermanent: true,
      messageIds: ['10', '11']
    });
  });

  it('ignores cache-only updateDeleteMessages', async () => {
    const { context, publishTelegramMessageDeleted, transaction } = createHandlerContext();

    const update = wireUpdateDeleteMessages({
      _: 'updateDeleteMessages',
      chat_id: 20,
      from_cache: true,
      is_permanent: false,
      message_ids: [10]
    });
    await handleUpdateDeleteMessages(context, update);

    expect(transaction).not.toHaveBeenCalled();
    expect(publishTelegramMessageDeleted).not.toHaveBeenCalled();
  });

  it('ignores non-permanent updateDeleteMessages', async () => {
    const { context, publishTelegramMessageDeleted, transaction } = createHandlerContext();

    const update = wireUpdateDeleteMessages({
      _: 'updateDeleteMessages',
      chat_id: 20,
      from_cache: false,
      is_permanent: false,
      message_ids: [10]
    });
    await handleUpdateDeleteMessages(context, update);

    expect(transaction).not.toHaveBeenCalled();
    expect(publishTelegramMessageDeleted).not.toHaveBeenCalled();
  });
});

function createHandlerContext(options: { insertedRows?: unknown[] } = {}): {
  context: TelegramUpdateHandlerContext;
  insert: ReturnType<typeof vi.fn>;
  deleteRows: ReturnType<typeof vi.fn>;
  onConflictDoNothing: ReturnType<typeof vi.fn>;
  onConflictDoUpdate: ReturnType<typeof vi.fn>;
  publishTelegramChatDirectoryUpdated: ReturnType<typeof vi.fn>;
  publishTelegramMessageCreated: ReturnType<typeof vi.fn>;
  publishTelegramMessageDeleted: ReturnType<typeof vi.fn>;
  recordChatFiles: ReturnType<typeof vi.fn>;
  recordMessageFiles: ReturnType<typeof vi.fn>;
  recordLiveMessage: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
} {
  const recordMessageFiles = vi.fn(() => Promise.resolve(undefined));
  const recordChatFiles = vi.fn(() => Promise.resolve(undefined));
  const returning = vi.fn(() =>
    Promise.resolve(
      options.insertedRows ?? [
        {
          id: '10'
        }
      ]
    )
  );
  const onConflictDoNothing = vi.fn(() => ({
    returning
  }));
  const onConflictDoUpdate = vi.fn(() => ({
    returning
  }));
  const publishTelegramMessageCreated = vi.fn();
  const publishTelegramChatDirectoryUpdated = vi.fn(() => Promise.resolve(undefined));
  const publishTelegramChatFoldersUpdated = vi.fn();
  const publishTelegramMessageDeleted = vi.fn();
  const publishTelegramMessageUpdated = vi.fn();
  const publishTelegramUserUpdated = vi.fn();
  const recordLiveMessage = vi.fn(() => Promise.resolve(undefined));
  const values = vi.fn(() => ({
    onConflictDoNothing,
    onConflictDoUpdate
  }));
  const insert = vi.fn(() => ({
    values
  }));
  const where = vi.fn(() => Promise.resolve([]));
  const deleteRows = vi.fn(() => ({
    where
  }));
  const transaction = vi.fn(
    (callback: (transaction: { delete: typeof deleteRows; insert: typeof insert }) => unknown) =>
      Promise.resolve(
        callback({
          delete: deleteRows,
          insert
        })
      )
  );

  return {
    context: {
      database: {
        delete: deleteRows,
        insert,
        transaction
      } as unknown as TelegramDatabase,
      events: {
        publishTelegramChatDirectoryUpdated,
        publishTelegramChatFoldersUpdated,
        publishTelegramMessageCreated,
        publishTelegramMessageDeleted,
        publishTelegramMessageUpdated,
        publishTelegramUserUpdated
      },
      files: {
        close: vi.fn(),
        getQueueStats: vi.fn(),
        handleUpdateFile: vi.fn(),
        recordChatFiles,
        recordMessageContentFiles: vi.fn(),
        recordMessageFiles,
        requestFile: vi.fn()
      },
      liveCoverageObserver: {
        markConnected: vi.fn(() => Promise.resolve(undefined)),
        markDisconnected: vi.fn(() => Promise.resolve(undefined)),
        recordLiveMessage,
        tick: vi.fn(() => Promise.resolve(undefined)),
        wait: vi.fn(() => Promise.resolve(undefined))
      },
      tdlibStatus: {
        markConnectionState: vi.fn(() => true)
      }
    },
    deleteRows,
    insert,
    onConflictDoNothing,
    onConflictDoUpdate,
    publishTelegramChatDirectoryUpdated,
    publishTelegramMessageCreated,
    publishTelegramMessageDeleted,
    recordChatFiles,
    recordMessageFiles,
    recordLiveMessage,
    returning,
    transaction,
    values
  };
}

function expectObjectContaining(value: Record<string, unknown>): unknown {
  return expect.objectContaining(value);
}

function wireMessage(overrides: Record<string, unknown>): TelegramWireMessage {
  return {
    _: 'message',
    author_signature: '',
    auto_delete_in: 0,
    can_be_saved: true,
    chat_id: 20,
    contains_unread_mention: false,
    content: {
      _: 'messageText',
      text: {
        _: 'formattedText',
        entities: [],
        text: ''
      }
    },
    date: 1_710_000_000,
    edit_date: 0,
    effect_id: '0',
    has_timestamped_media: false,
    id: 10,
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
    via_bot_user_id: 0,
    ...overrides
  };
}

function wireUpdateNewMessage(update: unknown): TelegramWireNewMessageUpdate {
  return update as TelegramWireNewMessageUpdate;
}

function wireUpdateNewChat(update: unknown): TelegramWireNewChatUpdate {
  return update as TelegramWireNewChatUpdate;
}

function wireUpdateChatLastMessage(update: unknown): TelegramWireChatLastMessageUpdate {
  return update as TelegramWireChatLastMessageUpdate;
}

function wireUpdateDeleteMessages(update: unknown): TelegramWireDeleteMessagesUpdate {
  return update as TelegramWireDeleteMessagesUpdate;
}
