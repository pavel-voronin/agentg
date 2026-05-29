import { beforeEach, describe, expect, it, vi } from 'vitest';

import '../src/main.js';
import type { TelegramDatabase } from '../src/database/client.js';
import { telegramChats, telegramFileSlots, telegramMessages } from '../src/database/schema.js';
import { useDatabase } from '../src/database/subsystem.js';
import { useUpdateEvents } from '../src/events/updateEvents.js';
import { useFiles } from '../src/files/subsystem.js';
import { useLiveCoverage } from '../src/history/subsystem.js';
import { useTelegramStatus } from '../src/status/subsystem.js';
import { handleUpdateChatLastMessage } from '../src/tdlib/update-handlers/updateChatLastMessage.js';
import { handleUpdateDeleteMessages } from '../src/tdlib/update-handlers/updateDeleteMessages.js';
import { handleUpdateNewChat } from '../src/tdlib/update-handlers/updateNewChat.js';
import { handleUpdateNewMessage } from '../src/tdlib/update-handlers/updateNewMessage.js';
import type {
  TelegramWireChatLastMessageUpdate,
  TelegramWireDeleteMessagesUpdate,
  TelegramWireMessage,
  TelegramWireNewChatUpdate,
  TelegramWireNewMessageUpdate
} from '../src/tdlib/wire.js';

describe('TDLib update handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists updateNewMessage through message type operations', async () => {
    const {
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
    await handleUpdateNewMessage(update);

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
    expect(publishTelegramMessageCreated).toHaveBeenCalledWith(update.message);
  });

  it('does not publish side effects when updateNewMessage already exists', async () => {
    const { insert, publishTelegramMessageCreated, recordLiveMessage, recordMessageFiles } =
      createHandlerContext({ insertedRows: [] });

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
    await handleUpdateNewMessage(update);

    expect(insert).toHaveBeenCalledWith(telegramMessages);
    expect(recordMessageFiles).not.toHaveBeenCalled();
    expect(recordLiveMessage).not.toHaveBeenCalled();
    expect(publishTelegramMessageCreated).not.toHaveBeenCalled();
  });

  it('persists updateNewChat last_message as a message row and chat last_message_id', async () => {
    const {
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

    await handleUpdateNewChat(update);

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

    await handleUpdateChatLastMessage(update);

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
    const { recordMessageFiles, values } = createHandlerContext();
    const update = wireUpdateChatLastMessage({
      _: 'updateChatLastMessage',
      chat_id: 20,
      last_message: null,
      positions: []
    });

    await handleUpdateChatLastMessage(update);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '20',
        lastMessageId: null
      })
    );
    expect(recordMessageFiles).not.toHaveBeenCalled();
  });

  it('clears chat last_message_id when updateChatLastMessage omits last_message', async () => {
    const { recordMessageFiles, values } = createHandlerContext();
    const update = wireUpdateChatLastMessage({
      _: 'updateChatLastMessage',
      chat_id: 20,
      positions: []
    });

    await handleUpdateChatLastMessage(update);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '20',
        lastMessageId: null
      })
    );
    expect(recordMessageFiles).not.toHaveBeenCalled();
  });

  it('hard-deletes stored messages for permanent updateDeleteMessages', async () => {
    const { deleteRows, publishTelegramMessageDeleted, transaction } = createHandlerContext();

    const update = wireUpdateDeleteMessages({
      _: 'updateDeleteMessages',
      chat_id: 20,
      from_cache: false,
      is_permanent: true,
      message_ids: [10, 11]
    });
    await handleUpdateDeleteMessages(update);

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
    const { publishTelegramMessageDeleted, transaction } = createHandlerContext();

    const update = wireUpdateDeleteMessages({
      _: 'updateDeleteMessages',
      chat_id: 20,
      from_cache: true,
      is_permanent: false,
      message_ids: [10]
    });
    await handleUpdateDeleteMessages(update);

    expect(transaction).not.toHaveBeenCalled();
    expect(publishTelegramMessageDeleted).not.toHaveBeenCalled();
  });

  it('ignores non-permanent updateDeleteMessages', async () => {
    const { publishTelegramMessageDeleted, transaction } = createHandlerContext();

    const update = wireUpdateDeleteMessages({
      _: 'updateDeleteMessages',
      chat_id: 20,
      from_cache: false,
      is_permanent: false,
      message_ids: [10]
    });
    await handleUpdateDeleteMessages(update);

    expect(transaction).not.toHaveBeenCalled();
    expect(publishTelegramMessageDeleted).not.toHaveBeenCalled();
  });
});

function createHandlerContext(options: { insertedRows?: unknown[] } = {}): {
  insert: ReturnType<typeof vi.fn>;
  deleteRows: ReturnType<typeof vi.fn>;
  onConflictDoNothing: ReturnType<typeof vi.fn>;
  onConflictDoUpdate: ReturnType<typeof vi.fn>;
  publishTelegramChatDirectoryUpdated: ReturnType<typeof vi.fn>;
  publishTelegramDirectMessagesChatTopicUpdated: ReturnType<typeof vi.fn>;
  publishTelegramEmojiChatThemesUpdated: ReturnType<typeof vi.fn>;
  publishTelegramFileDownloadRemoved: ReturnType<typeof vi.fn>;
  publishTelegramFileDownloadUpdated: ReturnType<typeof vi.fn>;
  publishTelegramFileDownloadsUpdated: ReturnType<typeof vi.fn>;
  publishTelegramForumTopicInfoUpdated: ReturnType<typeof vi.fn>;
  publishTelegramForumTopicUpdated: ReturnType<typeof vi.fn>;
  publishTelegramFreezeStateUpdated: ReturnType<typeof vi.fn>;
  publishTelegramGiftAuctionStateUpdated: ReturnType<typeof vi.fn>;
  publishTelegramGroupCallUpdated: ReturnType<typeof vi.fn>;
  publishTelegramGroupCallEncryptedParticipantUsersUpdated: ReturnType<typeof vi.fn>;
  publishTelegramGroupCallMessageSendFailed: ReturnType<typeof vi.fn>;
  publishTelegramGroupCallParticipantUpdatedOrRemoved: ReturnType<typeof vi.fn>;
  publishTelegramGroupCallMessagesDeleted: ReturnType<typeof vi.fn>;
  publishTelegramGroupCallVerificationStateUpdated: ReturnType<typeof vi.fn>;
  publishTelegramGroupCallMessageCreated: ReturnType<typeof vi.fn>;
  publishTelegramGroupCallPaidReactionReceived: ReturnType<typeof vi.fn>;
  publishTelegramGuestQueryReceived: ReturnType<typeof vi.fn>;
  publishTelegramInlineCallbackQueryReceived: ReturnType<typeof vi.fn>;
  publishTelegramInlineQueryReceived: ReturnType<typeof vi.fn>;
  publishTelegramLiveStoryTopDonorsUpdated: ReturnType<typeof vi.fn>;
  publishTelegramManagedBotUpdated: ReturnType<typeof vi.fn>;
  publishTelegramBusinessCallbackQueryReceived: ReturnType<typeof vi.fn>;
  publishTelegramCallbackQueryReceived: ReturnType<typeof vi.fn>;
  publishTelegramCallSignalingDataReceived: ReturnType<typeof vi.fn>;
  publishTelegramChatJoinRequestCreated: ReturnType<typeof vi.fn>;
  publishTelegramChosenInlineResultReceived: ReturnType<typeof vi.fn>;
  publishTelegramConnectionState: ReturnType<typeof vi.fn>;
  publishTelegramCustomEventReceived: ReturnType<typeof vi.fn>;
  publishTelegramCustomQueryReceived: ReturnType<typeof vi.fn>;
  publishTelegramMessageCreated: ReturnType<typeof vi.fn>;
  publishTelegramMessageDeleted: ReturnType<typeof vi.fn>;
  publishTelegramMessageSendFailed: ReturnType<typeof vi.fn>;
  publishTelegramMessageSendSucceeded: ReturnType<typeof vi.fn>;
  publishTelegramOauthRequestReceived: ReturnType<typeof vi.fn>;
  publishTelegramPaidMediaPurchased: ReturnType<typeof vi.fn>;
  publishTelegramPendingNotificationsUpdated: ReturnType<typeof vi.fn>;
  publishTelegramPendingTextMessageUpdated: ReturnType<typeof vi.fn>;
  publishTelegramPollAnswerUpdated: ReturnType<typeof vi.fn>;
  publishTelegramPollUpdated: ReturnType<typeof vi.fn>;
  publishTelegramPreCheckoutQueryReceived: ReturnType<typeof vi.fn>;
  publishTelegramQuickReplyShortcutDeleted: ReturnType<typeof vi.fn>;
  publishTelegramQuickReplyShortcutMessagesUpdated: ReturnType<typeof vi.fn>;
  publishTelegramQuickReplyShortcutUpdated: ReturnType<typeof vi.fn>;
  publishTelegramSavedMessagesTagsUpdated: ReturnType<typeof vi.fn>;
  publishTelegramSavedMessagesTopicUpdated: ReturnType<typeof vi.fn>;
  publishTelegramScopeNotificationSettingsUpdated: ReturnType<typeof vi.fn>;
  publishTelegramServiceNotificationReceived: ReturnType<typeof vi.fn>;
  publishTelegramShippingQueryReceived: ReturnType<typeof vi.fn>;
  publishTelegramSpeedLimitNotificationReceived: ReturnType<typeof vi.fn>;
  publishTelegramStakeDiceStateUpdated: ReturnType<typeof vi.fn>;
  publishTelegramStoryDeleted: ReturnType<typeof vi.fn>;
  publishTelegramStoryPostFailed: ReturnType<typeof vi.fn>;
  publishTelegramStoryPostSucceeded: ReturnType<typeof vi.fn>;
  publishTelegramStoryStealthModeUpdated: ReturnType<typeof vi.fn>;
  publishTelegramStoryUpdated: ReturnType<typeof vi.fn>;
  publishTelegramSuggestedActionsUpdated: ReturnType<typeof vi.fn>;
  publishTelegramTermsOfServiceRequired: ReturnType<typeof vi.fn>;
  publishTelegramTonRevenueStatusUpdated: ReturnType<typeof vi.fn>;
  publishTelegramUnconfirmedSessionUpdated: ReturnType<typeof vi.fn>;
  publishTelegramUnreadChatCountUpdated: ReturnType<typeof vi.fn>;
  publishTelegramUnreadMessageCountUpdated: ReturnType<typeof vi.fn>;
  publishTelegramUserStatusUpdated: ReturnType<typeof vi.fn>;
  publishTelegramUserFullInfoUpdated: ReturnType<typeof vi.fn>;
  publishTelegramUserPrivacySettingRulesUpdated: ReturnType<typeof vi.fn>;
  publishTelegramWebAppCloseRequested: ReturnType<typeof vi.fn>;
  publishTelegramStoredMessageUpdated: ReturnType<typeof vi.fn>;
  recordChatFiles: ReturnType<typeof vi.fn>;
  recordChatBackgroundFiles: ReturnType<typeof vi.fn>;
  recordChatPhotoFiles: ReturnType<typeof vi.fn>;
  recordChatThemeFiles: ReturnType<typeof vi.fn>;
  recordDefaultBackgroundFiles: ReturnType<typeof vi.fn>;
  recordEmojiChatThemeFiles: ReturnType<typeof vi.fn>;
  recordMessageFiles: ReturnType<typeof vi.fn>;
  recordNotificationFiles: ReturnType<typeof vi.fn>;
  recordQuickReplyMessageFiles: ReturnType<typeof vi.fn>;
  recordStickerSetFiles: ReturnType<typeof vi.fn>;
  recordStoryFiles: ReturnType<typeof vi.fn>;
  recordTrendingStickerSetFiles: ReturnType<typeof vi.fn>;
  recordUserFullInfoFiles: ReturnType<typeof vi.fn>;
  recordLiveMessage: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
} {
  const recordMessageFiles = vi.fn(() => Promise.resolve(undefined));
  const recordNotificationFiles = vi.fn(() => Promise.resolve(undefined));
  const recordNotificationGroupFiles = vi.fn(() => Promise.resolve(undefined));
  const recordQuickReplyMessageFiles = vi.fn(() => Promise.resolve(undefined));
  const recordStickerSetFiles = vi.fn(() => Promise.resolve(undefined));
  const recordStoryFiles = vi.fn(() => Promise.resolve(undefined));
  const recordTrendingStickerSetFiles = vi.fn(() => Promise.resolve(undefined));
  const recordUserFullInfoFiles = vi.fn(() => Promise.resolve(undefined));
  const recordChatBackgroundFiles = vi.fn(() => Promise.resolve(undefined));
  const recordChatPhotoFiles = vi.fn(() => Promise.resolve(undefined));
  const recordChatThemeFiles = vi.fn(() => Promise.resolve(undefined));
  const recordDefaultBackgroundFiles = vi.fn(() => Promise.resolve(undefined));
  const recordEmojiChatThemeFiles = vi.fn(() => Promise.resolve(undefined));
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
  const publishTelegramActiveGiftAuctionsUpdated = vi.fn();
  const publishTelegramActiveNotificationsUpdated = vi.fn();
  const publishTelegramAnimatedEmojiMessageClicked = vi.fn();
  const publishTelegramApplicationRecaptchaVerificationRequired = vi.fn();
  const publishTelegramApplicationVerificationRequired = vi.fn();
  const publishTelegramAttachmentMenuBotsUpdated = vi.fn();
  const publishTelegramAutosaveSettingsUpdated = vi.fn();
  const publishTelegramBusinessConnectionUpdated = vi.fn();
  const publishTelegramBusinessMessagesDeleted = vi.fn();
  const publishTelegramCallUpdated = vi.fn();
  const publishTelegramChatAction = vi.fn();
  const publishTelegramChatDirectoryUpdated = vi.fn(() => Promise.resolve(undefined));
  const publishTelegramChatFoldersUpdated = vi.fn();
  const publishTelegramChatMemberUpdated = vi.fn();
  const publishTelegramChatOnlineMemberCountUpdated = vi.fn();
  const publishTelegramDefaultBackgroundUpdated = vi.fn();
  const publishTelegramDirectMessagesChatTopicUpdated = vi.fn();
  const publishTelegramEmojiChatThemesUpdated = vi.fn();
  const publishTelegramFileDownloadRemoved = vi.fn();
  const publishTelegramFileDownloadUpdated = vi.fn();
  const publishTelegramFileDownloadsUpdated = vi.fn();
  const publishTelegramForumTopicInfoUpdated = vi.fn();
  const publishTelegramForumTopicUpdated = vi.fn();
  const publishTelegramFreezeStateUpdated = vi.fn();
  const publishTelegramGiftAuctionStateUpdated = vi.fn();
  const publishTelegramGroupCallUpdated = vi.fn();
  const publishTelegramGroupCallEncryptedParticipantUsersUpdated = vi.fn();
  const publishTelegramGroupCallMessageSendFailed = vi.fn();
  const publishTelegramGroupCallParticipantUpdatedOrRemoved = vi.fn();
  const publishTelegramGroupCallMessagesDeleted = vi.fn();
  const publishTelegramGroupCallVerificationStateUpdated = vi.fn();
  const publishTelegramGroupCallMessageCreated = vi.fn();
  const publishTelegramGroupCallPaidReactionReceived = vi.fn();
  const publishTelegramGuestQueryReceived = vi.fn();
  const publishTelegramInlineCallbackQueryReceived = vi.fn();
  const publishTelegramInlineQueryReceived = vi.fn();
  const publishTelegramLiveStoryTopDonorsUpdated = vi.fn();
  const publishTelegramManagedBotUpdated = vi.fn();
  const publishTelegramBusinessCallbackQueryReceived = vi.fn();
  const publishTelegramCallbackQueryReceived = vi.fn();
  const publishTelegramCallSignalingDataReceived = vi.fn();
  const publishTelegramChatJoinRequestCreated = vi.fn();
  const publishTelegramChosenInlineResultReceived = vi.fn();
  const publishTelegramConnectionState = vi.fn();
  const publishTelegramCustomEventReceived = vi.fn();
  const publishTelegramCustomQueryReceived = vi.fn();
  const publishTelegramMessageDeleted = vi.fn();
  const publishTelegramMessageSendFailed = vi.fn();
  const publishTelegramMessageSendSucceeded = vi.fn();
  const publishTelegramMessageUpdated = vi.fn();
  const publishTelegramOauthRequestReceived = vi.fn();
  const publishTelegramPaidMediaPurchased = vi.fn();
  const publishTelegramPendingNotificationsUpdated = vi.fn();
  const publishTelegramPendingTextMessageUpdated = vi.fn();
  const publishTelegramPollAnswerUpdated = vi.fn();
  const publishTelegramPollUpdated = vi.fn();
  const publishTelegramPreCheckoutQueryReceived = vi.fn();
  const publishTelegramQuickReplyShortcutDeleted = vi.fn();
  const publishTelegramQuickReplyShortcutMessagesUpdated = vi.fn();
  const publishTelegramQuickReplyShortcutUpdated = vi.fn();
  const publishTelegramSavedMessagesTagsUpdated = vi.fn();
  const publishTelegramSavedMessagesTopicUpdated = vi.fn();
  const publishTelegramScopeNotificationSettingsUpdated = vi.fn();
  const publishTelegramServiceNotificationReceived = vi.fn();
  const publishTelegramShippingQueryReceived = vi.fn();
  const publishTelegramSpeedLimitNotificationReceived = vi.fn();
  const publishTelegramStakeDiceStateUpdated = vi.fn();
  const publishTelegramStoryDeleted = vi.fn();
  const publishTelegramStoryPostFailed = vi.fn();
  const publishTelegramStoryPostSucceeded = vi.fn();
  const publishTelegramStoryStealthModeUpdated = vi.fn();
  const publishTelegramStoryUpdated = vi.fn();
  const publishTelegramSuggestedActionsUpdated = vi.fn();
  const publishTelegramTermsOfServiceRequired = vi.fn();
  const publishTelegramTonRevenueStatusUpdated = vi.fn();
  const publishTelegramUnconfirmedSessionUpdated = vi.fn();
  const publishTelegramUnreadChatCountUpdated = vi.fn();
  const publishTelegramUnreadMessageCountUpdated = vi.fn();
  const publishTelegramUserStatusUpdated = vi.fn();
  const publishTelegramUserFullInfoUpdated = vi.fn();
  const publishTelegramUserPrivacySettingRulesUpdated = vi.fn();
  const publishTelegramWebAppCloseRequested = vi.fn();
  const publishTelegramStoredMessageUpdated = vi.fn();
  const publishTelegramSupergroupUpdated = vi.fn();
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

  useDatabase().configure({
    delete: deleteRows,
    insert,
    transaction
  } as unknown as TelegramDatabase);
  useUpdateEvents().configure({
    publishTelegramActiveGiftAuctionsUpdated,
    publishTelegramActiveNotificationsUpdated,
    publishTelegramAnimatedEmojiMessageClicked,
    publishTelegramApplicationRecaptchaVerificationRequired,
    publishTelegramApplicationVerificationRequired,
    publishTelegramAttachmentMenuBotsUpdated,
    publishTelegramAutosaveSettingsUpdated,
    publishTelegramBusinessConnectionUpdated,
    publishTelegramBusinessMessagesDeleted,
    publishTelegramCallUpdated,
    publishTelegramChatAction,
    publishTelegramChatDirectoryUpdated,
    publishTelegramChatFoldersUpdated,
    publishTelegramChatMemberUpdated,
    publishTelegramChatOnlineMemberCountUpdated,
    publishTelegramDefaultBackgroundUpdated,
    publishTelegramDirectMessagesChatTopicUpdated,
    publishTelegramEmojiChatThemesUpdated,
    publishTelegramFileDownloadRemoved,
    publishTelegramFileDownloadUpdated,
    publishTelegramFileDownloadsUpdated,
    publishTelegramForumTopicInfoUpdated,
    publishTelegramForumTopicUpdated,
    publishTelegramFreezeStateUpdated,
    publishTelegramGiftAuctionStateUpdated,
    publishTelegramGroupCallUpdated,
    publishTelegramGroupCallEncryptedParticipantUsersUpdated,
    publishTelegramGroupCallMessageSendFailed,
    publishTelegramGroupCallParticipantUpdatedOrRemoved,
    publishTelegramGroupCallMessagesDeleted,
    publishTelegramGroupCallVerificationStateUpdated,
    publishTelegramGroupCallMessageCreated,
    publishTelegramGroupCallPaidReactionReceived,
    publishTelegramGuestQueryReceived,
    publishTelegramInlineCallbackQueryReceived,
    publishTelegramInlineQueryReceived,
    publishTelegramLiveStoryTopDonorsUpdated,
    publishTelegramManagedBotUpdated,
    publishTelegramBusinessCallbackQueryReceived,
    publishTelegramCallbackQueryReceived,
    publishTelegramCallSignalingDataReceived,
    publishTelegramChatJoinRequestCreated,
    publishTelegramChosenInlineResultReceived,
    publishTelegramConnectionState,
    publishTelegramCustomEventReceived,
    publishTelegramCustomQueryReceived,
    publishTelegramMessageCreated,
    publishTelegramMessageDeleted,
    publishTelegramMessageSendFailed,
    publishTelegramMessageSendSucceeded,
    publishTelegramMessageUpdated,
    publishTelegramOauthRequestReceived,
    publishTelegramPaidMediaPurchased,
    publishTelegramPendingNotificationsUpdated,
    publishTelegramPendingTextMessageUpdated,
    publishTelegramPollAnswerUpdated,
    publishTelegramPollUpdated,
    publishTelegramPreCheckoutQueryReceived,
    publishTelegramQuickReplyShortcutDeleted,
    publishTelegramQuickReplyShortcutMessagesUpdated,
    publishTelegramQuickReplyShortcutUpdated,
    publishTelegramSavedMessagesTagsUpdated,
    publishTelegramSavedMessagesTopicUpdated,
    publishTelegramScopeNotificationSettingsUpdated,
    publishTelegramServiceNotificationReceived,
    publishTelegramShippingQueryReceived,
    publishTelegramSpeedLimitNotificationReceived,
    publishTelegramStakeDiceStateUpdated,
    publishTelegramStoryDeleted,
    publishTelegramStoryPostFailed,
    publishTelegramStoryPostSucceeded,
    publishTelegramStoryStealthModeUpdated,
    publishTelegramStoryUpdated,
    publishTelegramSuggestedActionsUpdated,
    publishTelegramTermsOfServiceRequired,
    publishTelegramTonRevenueStatusUpdated,
    publishTelegramUnconfirmedSessionUpdated,
    publishTelegramUnreadChatCountUpdated,
    publishTelegramUnreadMessageCountUpdated,
    publishTelegramUserStatusUpdated,
    publishTelegramUserFullInfoUpdated,
    publishTelegramUserPrivacySettingRulesUpdated,
    publishTelegramWebAppCloseRequested,
    publishTelegramStoredMessageUpdated,
    publishTelegramSupergroupUpdated,
    publishTelegramUserUpdated
  });
  useFiles().configure({
    close: vi.fn(),
    getQueueStats: vi.fn(),
    handleUpdateFile: vi.fn(),
    startFileGeneration: vi.fn(),
    stopFileGeneration: vi.fn(() => Promise.resolve(undefined)),
    recordChatBackgroundFiles,
    recordChatFiles,
    recordChatPhotoFiles,
    recordChatThemeFiles,
    recordDefaultBackgroundFiles,
    recordEmojiChatThemeFiles,
    recordMessageContentFiles: vi.fn(),
    recordMessageFiles,
    recordNotificationFiles,
    recordNotificationGroupFiles,
    recordQuickReplyMessageFiles,
    recordStickerSetFiles,
    recordStoryFiles,
    recordTrendingStickerSetFiles,
    recordUserFullInfoFiles,
    deleteStoryFileSlots: vi.fn(() => Promise.resolve(undefined)),
    requestFile: vi.fn()
  });
  useLiveCoverage().configure({
    markConnected: vi.fn(() => Promise.resolve(undefined)),
    markDisconnected: vi.fn(() => Promise.resolve(undefined)),
    recordLiveMessage,
    syncKnownChats: vi.fn(() => Promise.resolve(undefined)),
    tick: vi.fn(() => Promise.resolve(undefined)),
    wait: vi.fn(() => Promise.resolve(undefined))
  });
  useTelegramStatus().configure({
    markAuthenticated: vi.fn(),
    markConnectionState: vi.fn(() => true),
    markDisconnected: vi.fn(),
    publish: vi.fn()
  });

  return {
    deleteRows,
    insert,
    onConflictDoNothing,
    onConflictDoUpdate,
    publishTelegramChatDirectoryUpdated,
    publishTelegramDirectMessagesChatTopicUpdated,
    publishTelegramEmojiChatThemesUpdated,
    publishTelegramFileDownloadRemoved,
    publishTelegramFileDownloadUpdated,
    publishTelegramFileDownloadsUpdated,
    publishTelegramForumTopicInfoUpdated,
    publishTelegramForumTopicUpdated,
    publishTelegramFreezeStateUpdated,
    publishTelegramGiftAuctionStateUpdated,
    publishTelegramGroupCallUpdated,
    publishTelegramGroupCallEncryptedParticipantUsersUpdated,
    publishTelegramGroupCallMessageSendFailed,
    publishTelegramGroupCallParticipantUpdatedOrRemoved,
    publishTelegramGroupCallMessagesDeleted,
    publishTelegramGroupCallVerificationStateUpdated,
    publishTelegramGroupCallMessageCreated,
    publishTelegramGroupCallPaidReactionReceived,
    publishTelegramGuestQueryReceived,
    publishTelegramInlineCallbackQueryReceived,
    publishTelegramInlineQueryReceived,
    publishTelegramLiveStoryTopDonorsUpdated,
    publishTelegramManagedBotUpdated,
    publishTelegramBusinessCallbackQueryReceived,
    publishTelegramCallbackQueryReceived,
    publishTelegramCallSignalingDataReceived,
    publishTelegramChatJoinRequestCreated,
    publishTelegramChosenInlineResultReceived,
    publishTelegramConnectionState,
    publishTelegramCustomEventReceived,
    publishTelegramCustomQueryReceived,
    publishTelegramMessageCreated,
    publishTelegramMessageDeleted,
    publishTelegramMessageSendFailed,
    publishTelegramMessageSendSucceeded,
    publishTelegramOauthRequestReceived,
    publishTelegramPaidMediaPurchased,
    publishTelegramPendingNotificationsUpdated,
    publishTelegramPendingTextMessageUpdated,
    publishTelegramPollAnswerUpdated,
    publishTelegramPollUpdated,
    publishTelegramPreCheckoutQueryReceived,
    publishTelegramQuickReplyShortcutDeleted,
    publishTelegramQuickReplyShortcutMessagesUpdated,
    publishTelegramQuickReplyShortcutUpdated,
    publishTelegramSavedMessagesTagsUpdated,
    publishTelegramSavedMessagesTopicUpdated,
    publishTelegramScopeNotificationSettingsUpdated,
    publishTelegramServiceNotificationReceived,
    publishTelegramShippingQueryReceived,
    publishTelegramSpeedLimitNotificationReceived,
    publishTelegramStakeDiceStateUpdated,
    publishTelegramStoryDeleted,
    publishTelegramStoryPostFailed,
    publishTelegramStoryPostSucceeded,
    publishTelegramStoryStealthModeUpdated,
    publishTelegramStoryUpdated,
    publishTelegramSuggestedActionsUpdated,
    publishTelegramTermsOfServiceRequired,
    publishTelegramTonRevenueStatusUpdated,
    publishTelegramUnconfirmedSessionUpdated,
    publishTelegramUnreadChatCountUpdated,
    publishTelegramUnreadMessageCountUpdated,
    publishTelegramUserStatusUpdated,
    publishTelegramUserFullInfoUpdated,
    publishTelegramUserPrivacySettingRulesUpdated,
    publishTelegramWebAppCloseRequested,
    publishTelegramStoredMessageUpdated,
    recordChatFiles,
    recordChatBackgroundFiles,
    recordChatPhotoFiles,
    recordChatThemeFiles,
    recordDefaultBackgroundFiles,
    recordEmojiChatThemeFiles,
    recordMessageFiles,
    recordNotificationFiles,
    recordQuickReplyMessageFiles,
    recordStickerSetFiles,
    recordStoryFiles,
    recordTrendingStickerSetFiles,
    recordUserFullInfoFiles,
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
