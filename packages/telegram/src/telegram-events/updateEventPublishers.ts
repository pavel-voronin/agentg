import type { EventBus } from '@agentg/events/bus';
import { createIntegrationEvent } from '@agentg/events/envelope';
import type { JsonValue } from '@agentg/events/json';
import { and, eq } from 'drizzle-orm';

import type { TelegramDatabase } from '../database.js';
import {
  createTelegramDefaultBackgroundUpdatedEvent,
  createTelegramChatUpdatedEvent,
  createTelegramIntegrationEvents,
  type TelegramDefaultBackgroundUpdatedEventInput,
  type TelegramEventPersistResult,
  type TelegramEventSourceChatFolder,
  type TelegramEventSourceMessage,
  type TelegramEventSourceMessageContentUpdate,
  type TelegramEventSourceMessageServiceAction,
  type TelegramEventSourceUpdate,
  type TelegramEventSourceUser
} from '../integrationEvents.js';
import type { TelegramMessageTextEntity } from '../rpc/contracts.js';
import { getDirectoryEntryByChatId } from '../telegram-read-model/directory.js';
import { readMessageSelection } from '../telegram-read-model/message.js';
import { telegramMessages } from '../schema.js';
import {
  telegramWireDate,
  telegramWireId,
  telegramWireJsonValue,
  type TelegramWireChatFoldersUpdate,
  type TelegramWireMessage,
  type TelegramWireMessageContentUpdate,
  type TelegramWireObject,
  type TelegramWireUpdateByType,
  type TelegramWireUser
} from '../telegramWire.js';

const CHAT_FOLDERS_UPDATED: TelegramEventPersistResult = {
  chat: false,
  chatFolders: true,
  message: false,
  user: false
};

const MESSAGE_UPDATED: TelegramEventPersistResult = {
  chat: false,
  chatFolders: false,
  message: true,
  user: false
};

const USER_UPDATED: TelegramEventPersistResult = {
  chat: false,
  chatFolders: false,
  message: false,
  user: true
};

export type TelegramMessagesDeletedEventInput = {
  chatId: string;
  deletedAt: Date;
  fromCache: boolean;
  isPermanent: boolean;
  messageIds: string[];
};

type TelegramWireActiveGiftAuctionsUpdate = TelegramWireUpdateByType<'updateActiveGiftAuctions'>;
type TelegramWireAnimatedEmojiMessageClickedUpdate =
  TelegramWireUpdateByType<'updateAnimatedEmojiMessageClicked'>;
type TelegramWireApplicationRecaptchaVerificationRequiredUpdate =
  TelegramWireUpdateByType<'updateApplicationRecaptchaVerificationRequired'>;
type TelegramWireApplicationVerificationRequiredUpdate =
  TelegramWireUpdateByType<'updateApplicationVerificationRequired'>;
type TelegramWireCall = TelegramWireUpdateByType<'updateCall'>['call'];
type TelegramWireCallSignalingDataUpdate = TelegramWireUpdateByType<'updateNewCallSignalingData'>;
type TelegramWireChatActionUpdate = TelegramWireUpdateByType<'updateChatAction'>;
type TelegramWireChatJoinRequestUpdate = TelegramWireUpdateByType<'updateNewChatJoinRequest'>;
type TelegramWireChatMemberUpdate = TelegramWireUpdateByType<'updateChatMember'>;
type TelegramWireChatOnlineMemberCountUpdate =
  TelegramWireUpdateByType<'updateChatOnlineMemberCount'>;
type TelegramWireChosenInlineResultUpdate = TelegramWireUpdateByType<'updateNewChosenInlineResult'>;
type TelegramWireCallbackQueryUpdate = TelegramWireUpdateByType<'updateNewCallbackQuery'>;
type TelegramWireConnectionStateUpdate = TelegramWireUpdateByType<'updateConnectionState'>;
type TelegramWireCustomEventUpdate = TelegramWireUpdateByType<'updateNewCustomEvent'>;
type TelegramWireCustomQueryUpdate = TelegramWireUpdateByType<'updateNewCustomQuery'>;
type TelegramWireFileDownloadUpdate = TelegramWireUpdateByType<'updateFileDownload'>;
type TelegramWireFileRemovedFromDownloadsUpdate =
  TelegramWireUpdateByType<'updateFileRemovedFromDownloads'>;
type TelegramWireGiftAuctionStateUpdate = TelegramWireUpdateByType<'updateGiftAuctionState'>;
type TelegramWireGroupCall = TelegramWireUpdateByType<'updateGroupCall'>['group_call'];
type TelegramWireNewGroupCallMessageUpdate = TelegramWireUpdateByType<'updateNewGroupCallMessage'>;
type TelegramWireNewGroupCallPaidReactionUpdate =
  TelegramWireUpdateByType<'updateNewGroupCallPaidReaction'>;
type TelegramWireGroupCallParticipantsUpdate =
  TelegramWireUpdateByType<'updateGroupCallParticipants'>;
type TelegramWireGroupCallVerificationStateUpdate =
  TelegramWireUpdateByType<'updateGroupCallVerificationState'>;
type TelegramWireHavePendingNotificationsUpdate =
  TelegramWireUpdateByType<'updateHavePendingNotifications'>;
type TelegramWireInlineCallbackQueryUpdate =
  TelegramWireUpdateByType<'updateNewInlineCallbackQuery'>;
type TelegramWireInlineQueryUpdate = TelegramWireUpdateByType<'updateNewInlineQuery'>;
type TelegramWireLiveStoryTopDonorsUpdate = TelegramWireUpdateByType<'updateLiveStoryTopDonors'>;
type TelegramWireNewBusinessCallbackQueryUpdate =
  TelegramWireUpdateByType<'updateNewBusinessCallbackQuery'>;
type TelegramWireNewShippingQueryUpdate = TelegramWireUpdateByType<'updateNewShippingQuery'>;
type TelegramWireOauthRequestUpdate = TelegramWireUpdateByType<'updateNewOauthRequest'>;
type TelegramWirePaidMediaPurchasedUpdate = TelegramWireUpdateByType<'updatePaidMediaPurchased'>;
type TelegramWirePendingTextMessageUpdate = TelegramWireUpdateByType<'updatePendingTextMessage'>;
type TelegramWirePollAnswerUpdate = TelegramWireUpdateByType<'updatePollAnswer'>;
type TelegramWirePollUpdate = TelegramWireUpdateByType<'updatePoll'>;
type TelegramWirePreCheckoutQueryUpdate = TelegramWireUpdateByType<'updateNewPreCheckoutQuery'>;
type TelegramWireQuickReplyShortcutDeletedUpdate =
  TelegramWireUpdateByType<'updateQuickReplyShortcutDeleted'>;
type TelegramWireQuickReplyShortcutMessagesUpdate =
  TelegramWireUpdateByType<'updateQuickReplyShortcutMessages'>;
type TelegramWireQuickReplyShortcutUpdate = TelegramWireUpdateByType<'updateQuickReplyShortcut'>;
type TelegramWireSavedMessagesTagsUpdate = TelegramWireUpdateByType<'updateSavedMessagesTags'>;
type TelegramWireSavedMessagesTopicUpdate = TelegramWireUpdateByType<'updateSavedMessagesTopic'>;
type TelegramWireServiceNotificationUpdate = TelegramWireUpdateByType<'updateServiceNotification'>;
type TelegramWireSpeedLimitNotificationUpdate =
  TelegramWireUpdateByType<'updateSpeedLimitNotification'>;
type TelegramWireStakeDiceStateUpdate = TelegramWireUpdateByType<'updateStakeDiceState'>;
type TelegramWireStoryUpdate = TelegramWireUpdateByType<'updateStory'>;
type TelegramWireStoryDeletedUpdate = TelegramWireUpdateByType<'updateStoryDeleted'>;
type TelegramWireStoryPostFailedUpdate = TelegramWireUpdateByType<'updateStoryPostFailed'>;
type TelegramWireStoryPostSucceededUpdate = TelegramWireUpdateByType<'updateStoryPostSucceeded'>;
type TelegramWireStoryStealthModeUpdate = TelegramWireUpdateByType<'updateStoryStealthMode'>;
type TelegramWireSuggestedActionsUpdate = TelegramWireUpdateByType<'updateSuggestedActions'>;
type TelegramWireTermsOfServiceUpdate = TelegramWireUpdateByType<'updateTermsOfService'>;
type TelegramWireTonRevenueStatusUpdate = TelegramWireUpdateByType<'updateTonRevenueStatus'>;
type TelegramWireUnconfirmedSessionUpdate = TelegramWireUpdateByType<'updateUnconfirmedSession'>;
type TelegramWireUnreadChatCountUpdate = TelegramWireUpdateByType<'updateUnreadChatCount'>;
type TelegramWireUnreadMessageCountUpdate = TelegramWireUpdateByType<'updateUnreadMessageCount'>;
type TelegramWireUserStatusUpdate = TelegramWireUpdateByType<'updateUserStatus'>;
type TelegramWireUserPrivacySettingRulesUpdate =
  TelegramWireUpdateByType<'updateUserPrivacySettingRules'>;
type TelegramWireWebAppMessageSentUpdate = TelegramWireUpdateByType<'updateWebAppMessageSent'>;

export type TelegramAutosaveSettingsUpdatedEventInput = {
  hasSettings: boolean;
  scopeKey: string;
};

export type TelegramBusinessMessagesDeletedEventInput = {
  chatId: string;
  connectionId: string;
  deletedAt: string;
  messageIds: string[];
};

export type TelegramChatMemberUpdatedEventInput = {
  actorUserId: string;
  chatId: string;
  inviteLink: JsonValue | null;
  newChatMember: JsonValue;
  occurredAt: string;
  oldChatMember: JsonValue;
  viaChatFolderInviteLink: boolean;
  viaJoinRequest: boolean;
};

export type TelegramDirectMessagesChatTopicUpdatedEventInput = {
  chatId: string;
  topicId: string;
};

export type TelegramFileDownloadsUpdatedEventInput =
  | {
      downloaded_size: number;
      total_count: number;
      total_size: number;
    }
  | {
      counts: JsonValue | null;
      fileId: number;
    };

export type TelegramForumTopicInfoUpdatedEventInput = {
  chatId: string;
  forumTopicId: number;
};

export type TelegramForumTopicUpdatedEventInput = {
  chatId: string;
  forumTopicId: number;
};

export type TelegramFreezeStateUpdatedEventInput = {
  appeal_link: string;
  deletion_date: number;
  freezing_date: number;
  is_frozen: boolean;
};

export type TelegramGroupCallMessagesDeletedEventInput = {
  groupCallId: number;
  messageIds: number[];
};

export type TelegramGroupCallMessageSendFailedEventInput = {
  error: JsonValue;
  groupCallId: number;
  messageId: number;
};

export type TelegramGroupCallParticipantUpdatedOrRemovedEventInput = {
  groupCallId: number;
  participant: JsonValue;
  participantId: string;
  removed: boolean;
};

export type TelegramGuestQueryReceivedEventInput = {
  id: string;
  message: TelegramWireMessage;
  referenceMessages: readonly TelegramWireMessage[];
};

export type TelegramManagedBotUpdatedEventInput = {
  botUserId: string;
  creatorUserId: string;
};

export type TelegramMessageSendFailedEventInput = {
  chatId: string;
  error: JsonValue;
  messageId: string;
  oldMessageId: string;
};

export type TelegramMessageSendSucceededEventInput = {
  chatId: string;
  message: TelegramWireMessage;
  messageId: string;
  oldMessageId: string;
};

export type TelegramStoredMessageUpdatedEventInput = {
  chatId: string;
  messageId: string;
};

export type TelegramUserFullInfoUpdatedEventInput = {
  userId: string;
};

const TELEGRAM_CHAT_ACTION_EVENT_TYPES = {
  chatActionCancel: 'telegram.chat_action_cancel',
  chatActionChoosingContact: 'telegram.chat_action_choosing_contact',
  chatActionChoosingLocation: 'telegram.chat_action_choosing_location',
  chatActionChoosingSticker: 'telegram.chat_action_choosing_sticker',
  chatActionRecordingVideo: 'telegram.chat_action_recording_video',
  chatActionRecordingVideoNote: 'telegram.chat_action_recording_video_note',
  chatActionRecordingVoiceNote: 'telegram.chat_action_recording_voice_note',
  chatActionStartPlayingGame: 'telegram.chat_action_start_playing_game',
  chatActionTyping: 'telegram.chat_action_typing',
  chatActionUploadingDocument: 'telegram.chat_action_uploading_document',
  chatActionUploadingPhoto: 'telegram.chat_action_uploading_photo',
  chatActionUploadingVideo: 'telegram.chat_action_uploading_video',
  chatActionUploadingVideoNote: 'telegram.chat_action_uploading_video_note',
  chatActionUploadingVoiceNote: 'telegram.chat_action_uploading_voice_note',
  chatActionWatchingAnimations: 'telegram.chat_action_watching_animations'
} as const satisfies Record<TelegramWireChatActionUpdate['action']['_'], string>;

const TELEGRAM_CONNECTION_STATE_EVENT_TYPES = {
  connectionStateConnecting: 'telegram.connection_state_connecting',
  connectionStateConnectingToProxy: 'telegram.connection_state_connecting_to_proxy',
  connectionStateReady: 'telegram.connection_state_ready',
  connectionStateUpdating: 'telegram.connection_state_updating',
  connectionStateWaitingForNetwork: 'telegram.connection_state_waiting_for_network'
} as const satisfies Record<TelegramWireConnectionStateUpdate['state']['_'], string>;

export function createTelegramUpdateEventPublishers(
  eventBus: EventBus,
  database: TelegramDatabase
) {
  function publishTelegramEvents(
    update: TelegramEventSourceUpdate,
    result: TelegramEventPersistResult
  ): void {
    for (const event of createTelegramIntegrationEvents(update, result)) {
      eventBus.publish(event);
    }
  }

  return {
    publishTelegramActiveGiftAuctionsUpdated(update: TelegramWireActiveGiftAuctionsUpdate): void {
      eventBus.publish(
        createIntegrationEvent({
          data: { states: telegramWireJsonValue(update.states) ?? [] },
          type: 'telegram.active_gift_auctions.updated'
        })
      );
    },
    publishTelegramActiveNotificationsUpdated(): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {},
          type: 'telegram.active_notifications.updated'
        })
      );
    },
    publishTelegramAnimatedEmojiMessageClicked(
      update: TelegramWireAnimatedEmojiMessageClickedUpdate
    ): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            chatId: String(update.chat_id),
            messageId: String(update.message_id),
            sticker: telegramWireJsonValue(update.sticker) ?? null
          },
          meta: {
            chatId: String(update.chat_id),
            messageId: String(update.message_id)
          },
          type: 'telegram.animated_emoji_message.clicked'
        })
      );
    },
    publishTelegramApplicationRecaptchaVerificationRequired(
      update: TelegramWireApplicationRecaptchaVerificationRequiredUpdate
    ): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            action: update.action,
            recaptchaKeyId: update.recaptcha_key_id,
            verificationId: String(update.verification_id)
          },
          type: 'telegram.application_recaptcha_verification.required'
        })
      );
    },
    publishTelegramApplicationVerificationRequired(
      update: TelegramWireApplicationVerificationRequiredUpdate
    ): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            cloudProjectNumber: update.cloud_project_number,
            nonce: update.nonce,
            verificationId: String(update.verification_id)
          },
          type: 'telegram.application_verification.required'
        })
      );
    },
    publishTelegramAttachmentMenuBotsUpdated(): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {},
          type: 'telegram.attachment_menu_bots.updated'
        })
      );
    },
    publishTelegramAutosaveSettingsUpdated(input: TelegramAutosaveSettingsUpdatedEventInput): void {
      eventBus.publish(
        createIntegrationEvent({
          data: input,
          type: 'telegram.autosave_settings.updated'
        })
      );
    },
    publishTelegramBusinessConnectionUpdated(connectionId: string): void {
      eventBus.publish(
        createIntegrationEvent({
          data: { connectionId },
          meta: { connectionId },
          type: 'telegram.business_connection.updated'
        })
      );
    },
    publishTelegramBusinessMessagesDeleted(input: TelegramBusinessMessagesDeletedEventInput): void {
      eventBus.publish(
        createIntegrationEvent({
          data: input,
          meta: {
            chatId: input.chatId,
            connectionId: input.connectionId
          },
          type: 'telegram.business_message.deleted'
        })
      );
    },
    publishTelegramCallUpdated(call: TelegramWireCall): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            id: call.id,
            isOutgoing: call.is_outgoing,
            isVideo: call.is_video,
            stateType: call.state._,
            uniqueId: call.unique_id,
            userId: String(call.user_id)
          },
          meta: {
            callId: String(call.id),
            userId: String(call.user_id)
          },
          type: 'telegram.call.updated'
        })
      );
    },
    publishTelegramCallSignalingDataReceived(update: TelegramWireCallSignalingDataUpdate): void {
      const callId = String(update.call_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            callId,
            data: update.data
          },
          meta: {
            callId
          },
          type: 'telegram.call.signaling_data.received'
        })
      );
    },
    publishTelegramCallbackQueryReceived(update: TelegramWireCallbackQueryUpdate): void {
      const chatId = String(update.chat_id);
      const messageId = String(update.message_id);
      const senderUserId = String(update.sender_user_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            chatId,
            chatInstance: requiredEventId(update.chat_instance),
            id: requiredEventId(update.id),
            messageId,
            payload: callbackQueryPayloadForEvent(update.payload),
            senderUserId
          },
          meta: {
            chatId,
            messageId,
            senderUserId
          },
          type: 'telegram.callback_query.received'
        })
      );
    },
    publishTelegramChatJoinRequestCreated(update: TelegramWireChatJoinRequestUpdate): void {
      const chatId = String(update.chat_id);
      const userId = String(update.request.user_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            chatId,
            inviteLink: telegramWireJsonValue(update.invite_link ?? null) ?? null,
            request: telegramWireJsonValue(update.request) ?? null,
            userChatId: String(update.user_chat_id),
            userId
          },
          meta: {
            chatId,
            userId
          },
          type: 'telegram.chat_join_request.created'
        })
      );
    },
    publishTelegramConnectionState(update: TelegramWireConnectionStateUpdate): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            state: update.state._
          },
          type: TELEGRAM_CONNECTION_STATE_EVENT_TYPES[update.state._]
        })
      );
    },
    publishTelegramChosenInlineResultReceived(update: TelegramWireChosenInlineResultUpdate): void {
      const senderUserId = String(update.sender_user_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            inlineMessageId: update.inline_message_id,
            query: update.query,
            resultId: update.result_id,
            senderUserId,
            userLocation: telegramWireJsonValue(update.user_location ?? null) ?? null
          },
          meta: {
            senderUserId
          },
          type: 'telegram.chosen_inline_result.received'
        })
      );
    },
    publishTelegramCustomEventReceived(update: TelegramWireCustomEventUpdate): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            event: update.event
          },
          type: 'telegram.custom_event.received'
        })
      );
    },
    publishTelegramCustomQueryReceived(update: TelegramWireCustomQueryUpdate): void {
      const queryId = requiredEventId(update.id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            data: update.data,
            id: queryId,
            timeout: update.timeout
          },
          meta: {
            queryId
          },
          type: 'telegram.custom_query.received'
        })
      );
    },
    publishTelegramInlineCallbackQueryReceived(
      update: TelegramWireInlineCallbackQueryUpdate
    ): void {
      const senderUserId = String(update.sender_user_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            chatInstance: requiredEventId(update.chat_instance),
            id: requiredEventId(update.id),
            inlineMessageId: update.inline_message_id,
            payload: callbackQueryPayloadForEvent(update.payload),
            senderUserId
          },
          meta: {
            inlineMessageId: update.inline_message_id,
            senderUserId
          },
          type: 'telegram.inline_callback_query.received'
        })
      );
    },
    publishTelegramInlineQueryReceived(update: TelegramWireInlineQueryUpdate): void {
      const queryId = requiredEventId(update.id);
      const senderUserId = String(update.sender_user_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            chatType: telegramWireJsonValue(update.chat_type ?? null) ?? null,
            id: queryId,
            offset: update.offset,
            query: update.query,
            senderUserId,
            userLocation: telegramWireJsonValue(update.user_location ?? null) ?? null
          },
          meta: {
            queryId,
            senderUserId
          },
          type: 'telegram.inline_query.received'
        })
      );
    },
    publishTelegramGroupCallUpdated(groupCall: TelegramWireGroupCall): void {
      const groupCallId = String(groupCall.id);
      eventBus.publish(
        createIntegrationEvent({
          data: { groupCallId },
          meta: { groupCallId },
          type: 'telegram.group_call.updated'
        })
      );
    },
    publishTelegramGroupCallMessageCreated(update: TelegramWireNewGroupCallMessageUpdate): void {
      const groupCallId = update.group_call_id;
      eventBus.publish(
        createIntegrationEvent({
          data: {
            groupCallId,
            message: telegramWireJsonValue(update.message) ?? null,
            messageId: update.message.message_id
          },
          meta: {
            groupCallId: String(groupCallId),
            messageId: String(update.message.message_id)
          },
          type: 'telegram.group_call_message.created'
        })
      );
    },
    publishTelegramGroupCallMessageSendFailed(
      input: TelegramGroupCallMessageSendFailedEventInput
    ): void {
      eventBus.publish(
        createIntegrationEvent({
          data: input,
          meta: {
            groupCallId: String(input.groupCallId),
            messageId: String(input.messageId)
          },
          type: 'telegram.group_call_message.send_failed'
        })
      );
    },
    publishTelegramGroupCallPaidReactionReceived(
      update: TelegramWireNewGroupCallPaidReactionUpdate
    ): void {
      const groupCallId = update.group_call_id;
      eventBus.publish(
        createIntegrationEvent({
          data: {
            groupCallId,
            senderId: telegramWireJsonValue(update.sender_id) ?? null,
            starCount: requiredEventId(update.star_count)
          },
          meta: {
            groupCallId: String(groupCallId)
          },
          type: 'telegram.group_call_paid_reaction.received'
        })
      );
    },
    publishTelegramGroupCallParticipantUpdatedOrRemoved(
      input: TelegramGroupCallParticipantUpdatedOrRemovedEventInput
    ): void {
      eventBus.publish(
        createIntegrationEvent({
          data: input,
          meta: {
            groupCallId: String(input.groupCallId),
            participantId: input.participantId
          },
          type: 'telegram.group_call_participant.updated-or-removed'
        })
      );
    },
    publishTelegramChatAction(update: TelegramWireChatActionUpdate): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            action: telegramWireJsonValue(update.action) ?? null,
            actionType: update.action._,
            chatId: String(update.chat_id),
            sender: telegramWireJsonValue(update.sender_id) ?? null,
            topic: telegramWireJsonValue(update.topic_id ?? null) ?? null
          },
          meta: {
            chatId: String(update.chat_id)
          },
          type: TELEGRAM_CHAT_ACTION_EVENT_TYPES[update.action._]
        })
      );
    },
    publishTelegramChatMemberUpdated(update: TelegramWireChatMemberUpdate): void {
      const input: TelegramChatMemberUpdatedEventInput = {
        actorUserId: String(update.actor_user_id),
        chatId: String(update.chat_id),
        inviteLink: telegramWireJsonValue(update.invite_link ?? null) ?? null,
        newChatMember: telegramWireJsonValue(update.new_chat_member) ?? null,
        occurredAt: unixDateString(update.date),
        oldChatMember: telegramWireJsonValue(update.old_chat_member) ?? null,
        viaChatFolderInviteLink: update.via_chat_folder_invite_link,
        viaJoinRequest: update.via_join_request
      };

      eventBus.publish(
        createIntegrationEvent({
          data: input,
          meta: {
            chatId: input.chatId
          },
          type: 'telegram.chat_member.updated'
        })
      );
    },
    publishTelegramChatOnlineMemberCountUpdated(
      update: TelegramWireChatOnlineMemberCountUpdate
    ): void {
      const chatId = String(update.chat_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            chatId,
            onlineMemberCount: update.online_member_count
          },
          meta: {
            chatId
          },
          type: 'telegram.chat.online_member_count.updated'
        })
      );
    },
    async publishTelegramChatDirectoryUpdated(chatId: string): Promise<void> {
      const chat = await getDirectoryEntryByChatId(database, chatId);
      eventBus.publish(
        chat === null
          ? createIntegrationEvent({
              data: { chatId },
              meta: { chatId },
              type: 'telegram.chat.removed'
            })
          : createTelegramChatUpdatedEvent(chat)
      );
    },
    publishTelegramChatFoldersUpdated(update: TelegramWireChatFoldersUpdate): void {
      publishTelegramEvents(
        { chatFolders: { folders: telegramChatFoldersUpdateSource(update) } },
        CHAT_FOLDERS_UPDATED
      );
    },
    publishTelegramDefaultBackgroundUpdated(
      input: TelegramDefaultBackgroundUpdatedEventInput
    ): void {
      eventBus.publish(createTelegramDefaultBackgroundUpdatedEvent(input));
    },
    publishTelegramDirectMessagesChatTopicUpdated(
      input: TelegramDirectMessagesChatTopicUpdatedEventInput
    ): void {
      eventBus.publish(
        createIntegrationEvent({
          data: input,
          meta: {
            chatId: input.chatId
          },
          type: 'telegram.direct_messages_chat_topic.updated'
        })
      );
    },
    publishTelegramFileDownloadRemoved(update: TelegramWireFileRemovedFromDownloadsUpdate): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            counts: telegramWireJsonValue(update.counts) ?? null,
            fileId: update.file_id
          },
          meta: {
            fileId: String(update.file_id)
          },
          type: 'telegram.file_download.removed'
        })
      );
    },
    publishTelegramFileDownloadUpdated(
      update: TelegramWireFileDownloadUpdate,
      options: { downloadRowPatched: boolean }
    ): void {
      const completeDate = telegramWireDate(update.complete_date);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            completeDate: completeDate === undefined ? null : completeDate.toISOString(),
            counts: telegramWireJsonValue(update.counts) ?? null,
            downloadRowPatched: options.downloadRowPatched,
            fileId: update.file_id,
            isPaused: update.is_paused
          },
          meta: {
            fileId: String(update.file_id)
          },
          type: 'telegram.file_download.updated'
        })
      );
    },
    publishTelegramFileDownloadsUpdated(input: TelegramFileDownloadsUpdatedEventInput): void {
      eventBus.publish(
        createIntegrationEvent({
          data: input,
          type: 'telegram.file_downloads.updated'
        })
      );
    },
    publishTelegramForumTopicInfoUpdated(input: TelegramForumTopicInfoUpdatedEventInput): void {
      eventBus.publish(
        createIntegrationEvent({
          data: input,
          meta: {
            chatId: input.chatId,
            forumTopicId: String(input.forumTopicId)
          },
          type: 'telegram.forum_topic_info.updated'
        })
      );
    },
    publishTelegramForumTopicUpdated(input: TelegramForumTopicUpdatedEventInput): void {
      eventBus.publish(
        createIntegrationEvent({
          data: input,
          meta: {
            chatId: input.chatId,
            forumTopicId: String(input.forumTopicId)
          },
          type: 'telegram.forum_topic.updated'
        })
      );
    },
    publishTelegramFreezeStateUpdated(input: TelegramFreezeStateUpdatedEventInput): void {
      eventBus.publish(
        createIntegrationEvent({
          data: input,
          type: 'telegram.freeze_state.updated'
        })
      );
    },
    publishTelegramGiftAuctionStateUpdated(update: TelegramWireGiftAuctionStateUpdate): void {
      const auctionInfo = update.state.gift.auction_info;
      if (auctionInfo === undefined) {
        throw new Error('Expected GiftAuctionState gift auction_info');
      }

      const auctionId = auctionInfo.id;
      const giftId = update.state.gift.id;
      eventBus.publish(
        createIntegrationEvent({
          data: {
            auctionId,
            giftId,
            state: telegramWireJsonValue(update.state) ?? null
          },
          meta: {
            auctionId,
            giftId
          },
          type: 'telegram.gift_auction_state.updated'
        })
      );
    },
    publishTelegramGroupCallMessagesDeleted(
      input: TelegramGroupCallMessagesDeletedEventInput
    ): void {
      eventBus.publish(
        createIntegrationEvent({
          data: input,
          meta: {
            groupCallId: String(input.groupCallId)
          },
          type: 'telegram.group_call_messages.deleted'
        })
      );
    },
    publishTelegramGroupCallEncryptedParticipantUsersUpdated(
      update: TelegramWireGroupCallParticipantsUpdate
    ): void {
      const groupCallId = String(update.group_call_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            groupCallId,
            participantUserIds: telegramWireJsonValue(update.participant_user_ids) ?? []
          },
          meta: {
            groupCallId
          },
          type: 'telegram.group_call_encrypted_participant_users.updated'
        })
      );
    },
    publishTelegramGroupCallVerificationStateUpdated(
      update: TelegramWireGroupCallVerificationStateUpdate
    ): void {
      const groupCallId = String(update.group_call_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            emojis: update.emojis,
            generation: update.generation,
            groupCallId
          },
          meta: {
            groupCallId
          },
          type: 'telegram.group_call_verification_state.updated'
        })
      );
    },
    publishTelegramGuestQueryReceived(input: TelegramGuestQueryReceivedEventInput): void {
      const chatId = String(input.message.chat_id);
      const messageId = String(input.message.id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            id: input.id,
            message: telegramWireJsonValue(input.message) ?? null,
            messageId,
            referenceMessages: input.referenceMessages.map((message) => ({
              chatId: String(message.chat_id),
              message: telegramWireJsonValue(message) ?? null,
              messageId: String(message.id)
            }))
          },
          meta: {
            chatId,
            messageId,
            queryId: input.id
          },
          type: 'telegram.guest_query.received'
        })
      );
    },
    publishTelegramLiveStoryTopDonorsUpdated(update: TelegramWireLiveStoryTopDonorsUpdate): void {
      const groupCallId = String(update.group_call_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            donors: telegramWireJsonValue(update.donors) ?? null,
            groupCallId
          },
          meta: {
            groupCallId
          },
          type: 'telegram.live_story_top_donors.updated'
        })
      );
    },
    publishTelegramManagedBotUpdated(input: TelegramManagedBotUpdatedEventInput): void {
      eventBus.publish(
        createIntegrationEvent({
          data: input,
          meta: {
            botUserId: input.botUserId,
            creatorUserId: input.creatorUserId
          },
          type: 'telegram.managed_bot.updated'
        })
      );
    },
    publishTelegramPendingNotificationsUpdated(
      update: TelegramWireHavePendingNotificationsUpdate
    ): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            hasPendingNotifications:
              update.have_delayed_notifications || update.have_unreceived_notifications,
            haveDelayedNotifications: update.have_delayed_notifications,
            haveUnreceivedNotifications: update.have_unreceived_notifications
          },
          type: 'telegram.pending_notifications.updated'
        })
      );
    },
    publishTelegramPaidMediaPurchased(update: TelegramWirePaidMediaPurchasedUpdate): void {
      const userId = String(update.user_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            payload: update.payload,
            userId
          },
          meta: {
            userId
          },
          type: 'telegram.paid_media.purchased'
        })
      );
    },
    publishTelegramPendingTextMessageUpdated(update: TelegramWirePendingTextMessageUpdate): void {
      const chatId = String(update.chat_id);
      const draftId = requiredEventId(update.draft_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            chatId,
            draftId,
            forumTopicId: update.forum_topic_id,
            text: telegramWireJsonValue(update.text) ?? null
          },
          meta: {
            chatId,
            draftId
          },
          type: 'telegram.pending_text_message.updated'
        })
      );
    },
    publishTelegramOauthRequestReceived(update: TelegramWireOauthRequestUpdate): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            domain: update.domain,
            location: update.location,
            url: update.url
          },
          type: 'telegram.oauth_request.received'
        })
      );
    },
    publishTelegramPreCheckoutQueryReceived(update: TelegramWirePreCheckoutQueryUpdate): void {
      const queryId = requiredEventId(update.id);
      const senderUserId = String(update.sender_user_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            currency: update.currency,
            id: queryId,
            invoicePayload: update.invoice_payload,
            orderInfo: telegramWireJsonValue(update.order_info ?? null) ?? null,
            senderUserId,
            shippingOptionId: update.shipping_option_id,
            totalAmount: requiredEventId(update.total_amount)
          },
          meta: {
            queryId,
            senderUserId
          },
          type: 'telegram.pre_checkout_query.received'
        })
      );
    },
    publishTelegramPollUpdated(update: TelegramWirePollUpdate): void {
      const pollId = requiredEventId(update.poll.id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            pollId
          },
          meta: {
            pollId
          },
          type: 'telegram.poll.updated'
        })
      );
    },
    publishTelegramPollAnswerUpdated(update: TelegramWirePollAnswerUpdate): void {
      const pollId = requiredEventId(update.poll_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            optionIds: update.option_ids,
            optionPositions: update.option_positions,
            pollId,
            voterId: telegramWireJsonValue(update.voter_id) ?? null
          },
          meta: {
            pollId
          },
          type: 'telegram.poll_answer.updated'
        })
      );
    },
    publishTelegramQuickReplyShortcutUpdated(update: TelegramWireQuickReplyShortcutUpdate): void {
      const shortcutId = String(update.shortcut.id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            firstMessageId: String(update.shortcut.first_message.id),
            messageCount: update.shortcut.message_count,
            name: update.shortcut.name,
            shortcutId
          },
          meta: {
            shortcutId
          },
          type: 'telegram.quick_reply_shortcut.updated'
        })
      );
    },
    publishTelegramQuickReplyShortcutDeleted(
      update: TelegramWireQuickReplyShortcutDeletedUpdate
    ): void {
      const shortcutId = String(update.shortcut_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            shortcutId
          },
          meta: {
            shortcutId
          },
          type: 'telegram.quick_reply_shortcut.deleted'
        })
      );
    },
    publishTelegramQuickReplyShortcutMessagesUpdated(
      update: TelegramWireQuickReplyShortcutMessagesUpdate
    ): void {
      const shortcutId = String(update.shortcut_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            messageIds: update.messages.map((message) => String(message.id)),
            shortcutId
          },
          meta: {
            shortcutId
          },
          type: 'telegram.quick_reply_shortcut.messages.updated'
        })
      );
    },
    publishTelegramSavedMessagesTagsUpdated(update: TelegramWireSavedMessagesTagsUpdate): void {
      const savedMessagesTopicId = String(update.saved_messages_topic_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            savedMessagesTopicId
          },
          meta: {
            savedMessagesTopicId
          },
          type: 'telegram.saved_messages_tags.updated'
        })
      );
    },
    publishTelegramSavedMessagesTopicUpdated(update: TelegramWireSavedMessagesTopicUpdate): void {
      const savedMessagesTopicId = String(update.topic.id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            savedMessagesTopicId
          },
          meta: {
            savedMessagesTopicId
          },
          type: 'telegram.saved_messages_topic.updated'
        })
      );
    },
    publishTelegramScopeNotificationSettingsUpdated(scopeKey: string): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            scopeKey
          },
          meta: {
            scopeKey
          },
          type: 'telegram.notification_settings.updated'
        })
      );
    },
    publishTelegramServiceNotificationReceived(
      update: TelegramWireServiceNotificationUpdate
    ): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            authKeyDrop: update.type.startsWith('AUTH_KEY_DROP_'),
            content: telegramWireJsonValue(update.content) ?? null,
            type: update.type
          },
          type: 'telegram.service_notification.received'
        })
      );
    },
    publishTelegramShippingQueryReceived(update: TelegramWireNewShippingQueryUpdate): void {
      const queryId = requiredEventId(update.id);
      const senderUserId = String(update.sender_user_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            id: queryId,
            invoicePayload: update.invoice_payload,
            senderUserId,
            shippingAddress: telegramWireJsonValue(update.shipping_address) ?? null
          },
          meta: {
            queryId,
            senderUserId
          },
          type: 'telegram.shipping_query.received'
        })
      );
    },
    publishTelegramSpeedLimitNotificationReceived(
      update: TelegramWireSpeedLimitNotificationUpdate
    ): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            direction: update.is_upload ? 'upload' : 'download',
            isUpload: update.is_upload
          },
          type: 'telegram.file_speed_limit_notification.received'
        })
      );
    },
    publishTelegramStakeDiceStateUpdated(update: TelegramWireStakeDiceStateUpdate): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            state: telegramWireJsonValue(update.state) ?? null
          },
          type: 'telegram.stake_dice_state.updated'
        })
      );
    },
    publishTelegramStoryUpdated(update: TelegramWireStoryUpdate): void {
      const posterChatId = String(update.story.poster_chat_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            posterChatId,
            storyId: update.story.id
          },
          meta: {
            posterChatId,
            storyId: String(update.story.id)
          },
          type: 'telegram.story.updated'
        })
      );
    },
    publishTelegramStoryDeleted(update: TelegramWireStoryDeletedUpdate): void {
      const posterChatId = String(update.story_poster_chat_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            posterChatId,
            storyId: update.story_id
          },
          meta: {
            posterChatId,
            storyId: String(update.story_id)
          },
          type: 'telegram.story.deleted'
        })
      );
    },
    publishTelegramStoryPostFailed(update: TelegramWireStoryPostFailedUpdate): void {
      const posterChatId = String(update.story.poster_chat_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            error: telegramWireJsonValue(update.error) ?? null,
            errorType: telegramWireJsonValue(update.error_type ?? null) ?? null,
            posterChatId,
            storyId: update.story.id
          },
          meta: {
            posterChatId,
            storyId: String(update.story.id)
          },
          type: 'telegram.story.post_failed'
        })
      );
    },
    publishTelegramStoryPostSucceeded(update: TelegramWireStoryPostSucceededUpdate): void {
      const posterChatId = String(update.story.poster_chat_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            oldStoryId: update.old_story_id,
            posterChatId,
            storyId: update.story.id
          },
          meta: {
            oldStoryId: String(update.old_story_id),
            posterChatId,
            storyId: String(update.story.id)
          },
          type: 'telegram.story.post_succeeded'
        })
      );
    },
    publishTelegramStoryStealthModeUpdated(update: TelegramWireStoryStealthModeUpdate): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            activeUntilDate: update.active_until_date,
            cooldownUntilDate: update.cooldown_until_date
          },
          type: 'telegram.story_stealth_mode.updated'
        })
      );
    },
    publishTelegramSuggestedActionsUpdated(update: TelegramWireSuggestedActionsUpdate): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            addedCount: update.added_actions.length,
            removedCount: update.removed_actions.length
          },
          type: 'telegram.suggested_actions.updated'
        })
      );
    },
    publishTelegramTermsOfServiceRequired(update: TelegramWireTermsOfServiceUpdate): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            showPopup: update.terms_of_service.show_popup,
            termsOfServiceId: update.terms_of_service_id
          },
          meta: {
            termsOfServiceId: update.terms_of_service_id
          },
          type: 'telegram.terms_of_service.required'
        })
      );
    },
    publishTelegramTonRevenueStatusUpdated(update: TelegramWireTonRevenueStatusUpdate): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            status: telegramWireJsonValue(update.status) ?? null
          },
          type: 'telegram.ton_revenue_status.updated'
        })
      );
    },
    publishTelegramUnconfirmedSessionUpdated(update: TelegramWireUnconfirmedSessionUpdate): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            session: telegramWireJsonValue(update.session ?? null) ?? null
          },
          type: 'telegram.unconfirmed_session.updated'
        })
      );
    },
    publishTelegramUnreadChatCountUpdated(update: TelegramWireUnreadChatCountUpdate): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            chatList: telegramWireJsonValue(update.chat_list) ?? null,
            markedAsUnreadCount: update.marked_as_unread_count,
            markedAsUnreadUnmutedCount: update.marked_as_unread_unmuted_count,
            totalCount: update.total_count,
            unreadCount: update.unread_count,
            unreadUnmutedCount: update.unread_unmuted_count
          },
          type: 'telegram.unread_chat_count.updated'
        })
      );
    },
    publishTelegramUnreadMessageCountUpdated(update: TelegramWireUnreadMessageCountUpdate): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            chatList: telegramWireJsonValue(update.chat_list) ?? null,
            unreadCount: update.unread_count,
            unreadUnmutedCount: update.unread_unmuted_count
          },
          type: 'telegram.unread_message_count.updated'
        })
      );
    },
    publishTelegramUserStatusUpdated(update: TelegramWireUserStatusUpdate): void {
      const userId = String(update.user_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            status: telegramWireJsonValue(update.status) ?? null,
            userId
          },
          meta: {
            userId
          },
          type: 'telegram.user.status.updated'
        })
      );
    },
    publishTelegramUserFullInfoUpdated(input: TelegramUserFullInfoUpdatedEventInput): void {
      eventBus.publish(
        createIntegrationEvent({
          data: input,
          meta: {
            userId: input.userId
          },
          type: 'telegram.user_full_info.updated'
        })
      );
    },
    publishTelegramUserPrivacySettingRulesUpdated(
      update: TelegramWireUserPrivacySettingRulesUpdate
    ): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {
            rules: telegramWireJsonValue(update.rules) ?? null,
            setting: telegramWireJsonValue(update.setting) ?? null
          },
          type: 'telegram.user_privacy_setting_rules.updated'
        })
      );
    },
    publishTelegramWebAppCloseRequested(update: TelegramWireWebAppMessageSentUpdate): void {
      const webAppLaunchId = requiredEventId(update.web_app_launch_id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            webAppLaunchId
          },
          meta: {
            webAppLaunchId
          },
          type: 'telegram.web_app.close_requested'
        })
      );
    },
    publishTelegramMessageSendFailed(input: TelegramMessageSendFailedEventInput): void {
      eventBus.publish(
        createIntegrationEvent({
          data: input,
          meta: {
            chatId: input.chatId,
            messageId: input.messageId,
            oldMessageId: input.oldMessageId
          },
          type: 'telegram.message.send_failed'
        })
      );
    },
    publishTelegramMessageSendSucceeded(input: TelegramMessageSendSucceededEventInput): void {
      eventBus.publish(
        createIntegrationEvent({
          data: input,
          meta: {
            chatId: input.chatId,
            messageId: input.messageId,
            oldMessageId: input.oldMessageId
          },
          type: 'telegram.message.send_succeeded'
        })
      );
    },
    publishTelegramBusinessCallbackQueryReceived(
      update: TelegramWireNewBusinessCallbackQueryUpdate
    ): void {
      const chatId = String(update.message.message.chat_id);
      const messageId = String(update.message.message.id);
      eventBus.publish(
        createIntegrationEvent({
          data: {
            chatId,
            chatInstance: update.chat_instance,
            connectionId: update.connection_id,
            id: update.id,
            messageId,
            payload: callbackQueryPayloadForEvent(update.payload),
            senderUserId: String(update.sender_user_id)
          },
          meta: {
            chatId,
            connectionId: update.connection_id,
            messageId
          },
          type: 'telegram.business_callback_query.received'
        })
      );
    },
    async publishTelegramStoredMessageUpdated(
      input: TelegramStoredMessageUpdatedEventInput
    ): Promise<void> {
      const [message] = await database
        .select(readMessageSelection())
        .from(telegramMessages)
        .where(
          and(eq(telegramMessages.chatId, input.chatId), eq(telegramMessages.id, input.messageId))
        )
        .limit(1);

      if (message === undefined) {
        return;
      }

      publishTelegramEvents(
        {
          contentUpdate: {
            chatId: message.telegramChatId,
            contentType: message.contentType,
            messageId: message.telegramMessageId,
            textEntities: [],
            ...(message.editDate === null ? {} : { editDate: message.editDate }),
            ...(message.text === null ? {} : { text: message.text })
          }
        },
        MESSAGE_UPDATED
      );
    },
    publishTelegramEmojiChatThemesUpdated(): void {
      eventBus.publish(
        createIntegrationEvent({
          data: {},
          type: 'telegram.emoji_chat_themes.updated'
        })
      );
    },
    publishTelegramMessageCreated(message: TelegramWireMessage): void {
      publishTelegramEvents({ message: telegramMessageEventSource(message) }, MESSAGE_UPDATED);
    },
    publishTelegramMessageDeleted(input: TelegramMessagesDeletedEventInput): void {
      publishTelegramEvents({ delete: input }, MESSAGE_UPDATED);
    },
    publishTelegramMessageUpdated(update: TelegramWireMessageContentUpdate): void {
      publishTelegramEvents(
        { contentUpdate: telegramMessageContentUpdateSource(update) },
        MESSAGE_UPDATED
      );
    },
    publishTelegramSupergroupUpdated(supergroupId: string): void {
      eventBus.publish(
        createIntegrationEvent({
          data: { supergroupId },
          meta: { supergroupId },
          type: 'telegram.supergroup.updated'
        })
      );
    },
    publishTelegramUserUpdated(user: TelegramWireUser, options: { isSelf?: boolean } = {}): void {
      publishTelegramEvents({ user: telegramUserEventSource(user, options) }, USER_UPDATED);
    }
  };
}

export type TelegramUpdateEventPublishers = ReturnType<typeof createTelegramUpdateEventPublishers>;

function telegramChatFoldersUpdateSource(
  update: TelegramWireChatFoldersUpdate
): TelegramEventSourceChatFolder[] {
  return update.chat_folders.map((folder, position) => ({
    id: folder.id,
    position,
    title: folder.name.text.text,
    ...(folder.icon.name.length === 0 ? {} : { iconName: folder.icon.name })
  }));
}

function unixDateString(value: number): string {
  return new Date(value * 1000).toISOString();
}

function requiredEventId(value: number | string | null | undefined): string {
  const id = telegramWireId(value);
  if (id === undefined) {
    throw new Error('Expected Telegram wire id');
  }
  return id;
}

function callbackQueryPayloadForEvent(payload: unknown): JsonValue {
  const json = telegramWireJsonValue(payload) ?? null;
  if (!isJsonRecord(json) || json._ !== 'callbackQueryPayloadDataWithPassword') {
    return json;
  }

  const safePayload = { ...json };
  delete safePayload.password;
  return {
    ...safePayload,
    hasPassword: true
  };
}

function isJsonRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function telegramUserEventSource(
  user: TelegramWireUser,
  options: { isSelf?: boolean }
): TelegramEventSourceUser {
  const username = activeUsername(user.usernames);
  return {
    firstName: user.first_name,
    id: String(user.id),
    isBot: user.type._ === 'userTypeBot',
    lastName: user.last_name,
    ...(options.isSelf === true ? { isSelf: true } : {}),
    ...(username === undefined ? {} : { username })
  };
}

function activeUsername(value: TelegramWireUser['usernames']): string | undefined {
  return value?.active_usernames[0];
}

function telegramMessageEventSource(message: TelegramWireMessage): TelegramEventSourceMessage {
  const senderId = messageSenderId(message);
  const senderType = message.sender_id._;
  const text = messageText(message);
  const messageDate = telegramWireDate(message.date);

  return {
    chatId: String(message.chat_id),
    contentType: message.content._,
    isOutgoing: message.is_outgoing,
    messageId: String(message.id),
    textEntities: messageTextEntities(message),
    ...(messageDate === undefined ? {} : { messageDate }),
    ...(senderId === undefined ? {} : { senderId }),
    senderType,
    ...(text === undefined ? {} : { text })
  };
}

function telegramMessageContentUpdateSource(
  update: TelegramWireMessageContentUpdate
): TelegramEventSourceMessageContentUpdate {
  const text = messageContentText(update.new_content);
  const serviceAction = messageContentServiceAction(update.new_content);

  return {
    chatId: String(update.chat_id),
    contentType: update.new_content._,
    messageId: String(update.message_id),
    textEntities: messageContentTextEntities(update.new_content),
    ...(text === undefined ? {} : { text }),
    ...(serviceAction === undefined ? {} : { serviceAction })
  };
}

function messageSenderId(message: TelegramWireMessage): string | undefined {
  const sender = message.sender_id as TelegramWireObject;
  return jsonId(sender.user_id) ?? jsonId(sender.chat_id);
}

function messageText(message: TelegramWireMessage): string | undefined {
  return messageContentText(message.content);
}

function messageTextEntities(message: TelegramWireMessage): TelegramMessageTextEntity[] {
  return messageContentTextEntities(message.content);
}

function messageContentText(content: unknown): string | undefined {
  const text = messageTextContent(content);
  return typeof text?.text === 'string' ? text.text : undefined;
}

function messageContentTextEntities(content: unknown): TelegramMessageTextEntity[] {
  const text = messageTextContent(content);
  return text === undefined ? [] : extractFormattedTextLinkEntities(text);
}

function messageContentServiceAction(
  content: unknown
): TelegramEventSourceMessageServiceAction | undefined {
  const object = recordValue(content);
  if (object?._ !== 'messageChatDeleteMember') {
    return undefined;
  }

  const userId = jsonId(object.user_id);
  return userId === undefined
    ? undefined
    : {
        kind: 'chatMemberLeft',
        userId
      };
}

function messageTextContent(content: unknown): TelegramWireObject | undefined {
  const object = recordValue(content);
  if (object?._ !== 'messageText') {
    return undefined;
  }
  return recordValue(object.text);
}

function extractFormattedTextLinkEntities(value: unknown): TelegramMessageTextEntity[] {
  const formattedText = recordValue(value);
  const text = typeof formattedText?.text === 'string' ? formattedText.text : '';
  const sourceEntities = Array.isArray(formattedText?.entities) ? formattedText.entities : [];
  const entities = sourceEntities
    .map((entity) => telegramTextLinkEntity(entity, text))
    .filter((entity): entity is TelegramMessageTextEntity => entity !== undefined)
    .sort(compareTextEntities);

  const result: TelegramMessageTextEntity[] = [];
  let consumedUntil = 0;
  for (const entity of entities) {
    if (entity.offset < consumedUntil) {
      continue;
    }
    result.push(entity);
    consumedUntil = entity.offset + entity.length;
  }
  return result;
}

function telegramTextLinkEntity(
  value: unknown,
  text: string
): TelegramMessageTextEntity | undefined {
  const entity = recordValue(value);
  const type = recordValue(entity?.type);
  const offset = safeInteger(entity?.offset);
  const length = safeInteger(entity?.length);
  if (
    offset === undefined ||
    length === undefined ||
    length <= 0 ||
    offset < 0 ||
    offset + length > text.length
  ) {
    return undefined;
  }

  if (type?._ === 'textEntityTypeUrl') {
    const url = normalizeHttpUrl(text.slice(offset, offset + length), true);
    return url === null ? undefined : { kind: 'url', length, offset, url };
  }

  if (type?._ === 'textEntityTypeTextUrl') {
    const url = normalizeHttpUrl(type.url, false);
    return url === null ? undefined : { kind: 'textUrl', length, offset, url };
  }

  return undefined;
}

function normalizeHttpUrl(value: unknown, allowMissingProtocol: boolean): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const directUrl = parseHttpUrl(trimmed);
  if (directUrl !== null || !allowMissingProtocol) {
    return directUrl;
  }
  return parseHttpUrl(`https://${trimmed}`);
}

function parseHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function compareTextEntities(
  left: TelegramMessageTextEntity,
  right: TelegramMessageTextEntity
): number {
  if (left.offset !== right.offset) {
    return left.offset - right.offset;
  }
  return right.length - left.length;
}

function safeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function jsonId(value: unknown): string | undefined {
  return typeof value === 'number' || typeof value === 'string' ? telegramWireId(value) : undefined;
}

function recordValue(value: unknown): TelegramWireObject | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as TelegramWireObject)
    : undefined;
}
