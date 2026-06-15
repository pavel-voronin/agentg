import { describe, expect, it, vi } from 'vitest';

import {
  telegramActiveLiveLocationMessages,
  telegramChats,
  telegramFileSlots,
  telegramMessages
} from '../src/database/schema.js';
import type { IngestionResources } from '../src/ingestion/resources.js';
import { handleUpdateChatLastMessage } from '../src/ingestion/adapters/update-handlers/updateChatLastMessage.js';
import { handleUpdateDeleteMessages } from '../src/ingestion/adapters/update-handlers/updateDeleteMessages.js';
import { handleUpdateMessageReaction } from '../src/ingestion/adapters/update-handlers/updateMessageReaction.js';
import { handleUpdateNewChat } from '../src/ingestion/adapters/update-handlers/updateNewChat.js';
import { handleUpdateNewMessage } from '../src/ingestion/adapters/update-handlers/updateNewMessage.js';

describe('TDLib update handlers', () => {
  it('persists updateNewMessage through message type operations', async () => {
    const context = createHandlerContext();
    const { insert, onConflictDoNothing, recordFileSlots } = context;
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

    const update = {
      _: 'updateNewMessage',
      message
    } as Parameters<typeof handleUpdateNewMessage>[0];
    await handleUpdateNewMessage(update, resourcesFromContext(context));

    expect(insert).toHaveBeenCalledWith(telegramMessages);
    expect(recordValue(context.recordedValues[0])).toMatchObject({
      authorSignature: 'channel admin',
      canBeSaved: true,
      chatId: '20',
      content: {
        _: 'messageText'
      },
      date: new Date(1_710_000_000 * 1000),
      effectId: '9901',
      id: '10',
      isChannelPost: true,
      isFromOffline: false,
      isOutgoing: false,
      mediaAlbumId: '8801',
      paidMessageStarCount: '5',
      senderBoostCount: 2,
      senderId: {
        _: 'messageSenderUser',
        user_id: 30
      },
      senderTag: 'tag',
      summaryLanguageCode: 'en',
      topicId: {
        _: 'messageTopicForum',
        forum_topic_id: 7
      },
      viaBotUserId: '40'
    });
    expect(onConflictDoNothing).toHaveBeenCalledWith({
      target: [telegramMessages.chatId, telegramMessages.id]
    });
    expect(context.events.publish).toHaveBeenCalledWith(
      'telegram.message.created',
      expect.anything()
    );
    expect(eventData(context, 'telegram.message.created')).toMatchObject({
      message: {
        chat: {
          _model: 'telegram.chat',
          id: '20'
        },
        id: '20:10',
        media: {
          files: []
        },
        sender: {
          _model: 'telegram.user',
          id: '30'
        },
        telegramMessageId: '10',
        text: 'example.com',
        textEntities: [
          {
            kind: 'url',
            length: 11,
            offset: 0,
            url: 'https://example.com/'
          }
        ]
      }
    });
    expect(context.events.publish.mock.invocationCallOrder[0]).toBeLessThan(
      recordFileSlots.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
    expect(hasRecordedMessageSlot(recordFileSlots, { chatId: '20', messageId: '10' })).toBe(true);
  });

  it('does not publish side effects when updateNewMessage already exists', async () => {
    const context = createHandlerContext({ insertedRows: [] });
    const resources = resourcesFromContext(context);
    const update = {
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
        id: 10,
        sender_id: {
          _: 'messageSenderUser',
          user_id: 30
        }
      })
    } as Parameters<typeof handleUpdateNewMessage>[0];

    await handleUpdateNewMessage(update, resources);

    expect(context.recordFileSlots).not.toHaveBeenCalled();
    expect(context.recordLiveMessage).not.toHaveBeenCalled();
    expect(context.events.publish).not.toHaveBeenCalled();
  });

  it('persists updateNewChat last_message as a message row and chat last_message_id', async () => {
    const context = createHandlerContext();
    const { insert, recordFileSlots, values } = context;
    const update = {
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
          id: 10,
          sender_id: {
            _: 'messageSenderUser',
            user_id: 30
          }
        }),
        positions: [],
        title: 'Chat',
        type: {
          _: 'chatTypePrivate',
          user_id: 30
        }
      }
    } as unknown as Parameters<typeof handleUpdateNewChat>[0];

    await handleUpdateNewChat(update, resourcesFromContext(context));

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
    expect(hasRecordedChatSlot(recordFileSlots, '20')).toBe(true);
    expect(hasRecordedMessageSlot(recordFileSlots, { chatId: '20', messageId: '10' })).toBe(true);
  });

  it('persists updateChatLastMessage message and updates chat last_message_id', async () => {
    const context = createHandlerContext();
    const { insert, recordFileSlots, values } = context;
    const update = {
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
        id: 10,
        sender_id: {
          _: 'messageSenderUser',
          user_id: 30
        }
      }),
      positions: []
    } as unknown as Parameters<typeof handleUpdateChatLastMessage>[0];

    await handleUpdateChatLastMessage(update, resourcesFromContext(context));

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
    expect(hasRecordedMessageSlot(recordFileSlots, { chatId: '20', messageId: '10' })).toBe(true);
  });

  it('clears chat last_message_id when updateChatLastMessage has no last_message', async () => {
    const context = createHandlerContext();
    const { recordFileSlots, values } = context;
    const update = {
      _: 'updateChatLastMessage',
      chat_id: 20,
      last_message: null,
      positions: []
    } as unknown as Parameters<typeof handleUpdateChatLastMessage>[0];

    await handleUpdateChatLastMessage(update, resourcesFromContext(context));

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '20',
        lastMessageId: null
      })
    );
    expect(recordFileSlots).not.toHaveBeenCalled();
  });

  it('hard-deletes stored messages for permanent updateDeleteMessages', async () => {
    const context = createHandlerContext();
    const { deleteRows, transaction } = context;

    const update = {
      _: 'updateDeleteMessages',
      chat_id: 20,
      from_cache: false,
      is_permanent: true,
      message_ids: [10, 11]
    } as Parameters<typeof handleUpdateDeleteMessages>[0];
    await handleUpdateDeleteMessages(update, resourcesFromContext(context));

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(deleteRows).toHaveBeenCalledWith(telegramFileSlots);
    expect(deleteRows).toHaveBeenCalledWith(telegramActiveLiveLocationMessages);
    expect(deleteRows).toHaveBeenCalledWith(telegramMessages);
    expect(context.events.publish).toHaveBeenCalledWith(
      'telegram.message.deleted',
      expect.anything()
    );
    expect(eventData(context, 'telegram.message.deleted')).toMatchObject({
      delete: {
        chat: {
          _model: 'telegram.chat',
          id: '20'
        },
        messages: [
          {
            _model: 'telegram.message',
            id: '20:10'
          },
          {
            _model: 'telegram.message',
            id: '20:11'
          }
        ]
      }
    });
  });

  it('ignores cache-only updateDeleteMessages', async () => {
    const context = createHandlerContext();
    const { transaction } = context;

    const update = {
      _: 'updateDeleteMessages',
      chat_id: 20,
      from_cache: true,
      is_permanent: false,
      message_ids: [10]
    } as Parameters<typeof handleUpdateDeleteMessages>[0];
    await handleUpdateDeleteMessages(update, resourcesFromContext(context));

    expect(transaction).not.toHaveBeenCalled();
    expect(context.events.publish).not.toHaveBeenCalled();
  });

  it('ignores non-permanent updateDeleteMessages', async () => {
    const context = createHandlerContext();
    const { transaction } = context;

    const update = {
      _: 'updateDeleteMessages',
      chat_id: 20,
      from_cache: false,
      is_permanent: false,
      message_ids: [10]
    } as Parameters<typeof handleUpdateDeleteMessages>[0];
    await handleUpdateDeleteMessages(update, resourcesFromContext(context));

    expect(transaction).not.toHaveBeenCalled();
    expect(context.events.publish).not.toHaveBeenCalled();
  });

  it('does not mark another sender reaction as chosen from existing aggregate rows', async () => {
    const context = createHandlerContext({
      currentAccountSenderKey: 'user:999',
      selectedRows: [
        {
          reactions: {
            reactions: [
              {
                is_chosen: true,
                recent_sender_ids: [],
                total_count: 1,
                type: {
                  _: 'reactionTypeEmoji',
                  emoji: '👍'
                },
                used_sender_id: {
                  _: 'messageSenderUser',
                  user_id: 30
                }
              }
            ]
          }
        }
      ]
    });
    const update = {
      _: 'updateMessageReaction',
      actor_id: {
        _: 'messageSenderUser',
        user_id: 30
      },
      chat_id: 20,
      date: 1_710_000_000,
      message_id: 10,
      new_reaction_types: [
        {
          _: 'reactionTypeEmoji',
          emoji: '🔥'
        }
      ],
      old_reaction_types: []
    } as Parameters<typeof handleUpdateMessageReaction>[0];

    await handleUpdateMessageReaction(update, resourcesFromContext(context));

    const fireReaction = recordedReactionValues(context).find(
      (reaction) => reactionTypeEmoji(reaction) === '🔥'
    );
    expect(fireReaction).toMatchObject({
      is_chosen: false,
      total_count: 1,
      type: {
        _: 'reactionTypeEmoji',
        emoji: '🔥'
      },
      used_sender_id: null
    });
  });

  it('marks current account reaction as chosen from account identity resource', async () => {
    const context = createHandlerContext({
      currentAccountSenderKey: 'user:30',
      selectedRows: []
    });
    const update = {
      _: 'updateMessageReaction',
      actor_id: {
        _: 'messageSenderUser',
        user_id: 30
      },
      chat_id: 20,
      date: 1_710_000_000,
      message_id: 10,
      new_reaction_types: [
        {
          _: 'reactionTypeEmoji',
          emoji: '🔥'
        }
      ],
      old_reaction_types: []
    } as Parameters<typeof handleUpdateMessageReaction>[0];

    await handleUpdateMessageReaction(update, resourcesFromContext(context));

    const fireReaction = recordedReactionValues(context).find(
      (reaction) => reactionTypeEmoji(reaction) === '🔥'
    );
    expect(fireReaction).toMatchObject({
      is_chosen: true,
      type: {
        _: 'reactionTypeEmoji',
        emoji: '🔥'
      },
      used_sender_id: {
        _: 'messageSenderUser',
        user_id: 30
      }
    });
  });
});

function resourcesFromContext(
  context: ReturnType<typeof createHandlerContext>
): IngestionResources {
  return {
    account: {
      senderKey: context.currentAccountSenderKey
    },
    database: context.database,
    events: context.events,
    files: {
      recordFileSlots: context.recordFileSlots
    },
    liveCoverage: {
      recordLiveMessage: context.recordLiveMessage
    },
    status: {}
  } as unknown as IngestionResources;
}

function createHandlerContext(
  options: {
    currentAccountSenderKey?: string;
    insertedRows?: unknown[];
    selectedRows?: unknown[];
  } = {}
) {
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
  const recordedValues: unknown[] = [];
  const values = vi.fn((row: unknown) => {
    recordedValues.push(row);
    return {
      onConflictDoNothing,
      onConflictDoUpdate
    };
  });
  const insert = vi.fn(() => ({
    values
  }));
  const forUpdate = vi.fn(() => Promise.resolve(options.selectedRows ?? []));
  const selectWhere = vi.fn(() => ({
    for: forUpdate
  }));
  const from = vi.fn(() => ({
    where: selectWhere
  }));
  const select = vi.fn(() => ({
    from
  }));
  const updateWhere = vi.fn(() => Promise.resolve(undefined));
  const set = vi.fn(() => ({
    where: updateWhere
  }));
  const updateRows = vi.fn(() => ({
    set
  }));
  const where = vi.fn(() => Promise.resolve([]));
  const deleteRows = vi.fn(() => ({
    where
  }));
  const database = {
    delete: deleteRows,
    insert,
    select,
    transaction: vi.fn((callback: (transaction: unknown) => unknown) =>
      Promise.resolve(callback(database))
    ),
    update: updateRows
  };
  const recordFileSlots = vi.fn<(recording: unknown, cause: string) => Promise<void>>(() =>
    Promise.resolve(undefined)
  );
  const recordLiveMessage = vi.fn(() => Promise.resolve(undefined));
  const events: { publish: ReturnType<typeof vi.fn<(type: string, data?: unknown) => void>> } = {
    publish: vi.fn<(type: string, data?: unknown) => void>()
  };

  return {
    currentAccountSenderKey: vi.fn(() => options.currentAccountSenderKey ?? 'user:30'),
    database: database as unknown as IngestionResources['database'],
    deleteRows,
    events,
    insert,
    onConflictDoNothing,
    onConflictDoUpdate,
    recordFileSlots,
    recordLiveMessage,
    recordedValues,
    returning,
    transaction: database.transaction,
    values
  };
}

function eventData(context: ReturnType<typeof createHandlerContext>, type: string): unknown {
  const event = context.events.publish.mock.calls.find(([eventType]) => eventType === type);
  return event?.[1];
}

function wireMessage(
  input: Record<string, unknown>
): Parameters<typeof handleUpdateNewMessage>[0]['message'] {
  return input as Parameters<typeof handleUpdateNewMessage>[0]['message'];
}

function recordValue(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('expected recorded row object');
  }
  return value as Record<string, unknown>;
}

function recordValueOrUndefined(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function hasRecordedChatSlot(
  recordFileSlots: ReturnType<typeof createHandlerContext>['recordFileSlots'],
  chatId: string
): boolean {
  return recordFileSlots.mock.calls.some(([recording, cause]) => {
    const update = recordValueOrUndefined(recordValueOrUndefined(recording)?.update);
    const chat = recordValueOrUndefined(update?.chat);
    const chatData = recordValueOrUndefined(chat?.chat);
    return cause === 'live_update' && chat?.id === chatId && chatData?._ === 'chat';
  });
}

function hasRecordedMessageSlot(
  recordFileSlots: ReturnType<typeof createHandlerContext>['recordFileSlots'],
  input: {
    chatId: string;
    messageId: string;
  }
): boolean {
  return recordFileSlots.mock.calls.some(([recording, cause]) => {
    const update = recordValueOrUndefined(recordValueOrUndefined(recording)?.update);
    const message = recordValueOrUndefined(update?.message);
    const content = recordValueOrUndefined(message?.content);
    return (
      cause === 'live_update' &&
      message?.chatId === input.chatId &&
      message.messageId === input.messageId &&
      content?._ === 'messageText'
    );
  });
}

function recordedReactionValues(context: ReturnType<typeof createHandlerContext>) {
  return context.recordedValues.map(recordValue).flatMap((value) => {
    const reactions = recordOrNull(value.reactions);
    return reactions === null ? [] : recordArray(reactions.reactions).map(recordValue);
  });
}

function reactionTypeEmoji(reaction: Record<string, unknown>): string | undefined {
  const type = recordOrNull(reaction.type);
  return type?._ === 'reactionTypeEmoji' && typeof type.emoji === 'string' ? type.emoji : undefined;
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function recordArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
