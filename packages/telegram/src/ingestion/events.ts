import type { EventBus } from '@agentg/framework';

type UpdateEventPublisher = (...args: unknown[]) => Promise<void>;

export type UpdateEvents = {
  publishTelegramActiveGiftAuctionsUpdated: UpdateEventPublisher;
  publishTelegramActiveNotificationsUpdated: UpdateEventPublisher;
  publishTelegramAnimatedEmojiMessageClicked: UpdateEventPublisher;
  publishTelegramApplicationRecaptchaVerificationRequired: UpdateEventPublisher;
  publishTelegramApplicationVerificationRequired: UpdateEventPublisher;
  publishTelegramAttachmentMenuBotsUpdated: UpdateEventPublisher;
  publishTelegramAutosaveSettingsUpdated: UpdateEventPublisher;
  publishTelegramBusinessCallbackQueryReceived: UpdateEventPublisher;
  publishTelegramBusinessConnectionUpdated: UpdateEventPublisher;
  publishTelegramBusinessMessagesDeleted: UpdateEventPublisher;
  publishTelegramCallSignalingDataReceived: UpdateEventPublisher;
  publishTelegramCallUpdated: UpdateEventPublisher;
  publishTelegramCallbackQueryReceived: UpdateEventPublisher;
  publishTelegramChatAction: UpdateEventPublisher;
  publishTelegramChatDirectoryUpdated: UpdateEventPublisher;
  publishTelegramChatFoldersUpdated: UpdateEventPublisher;
  publishTelegramChatJoinRequestCreated: UpdateEventPublisher;
  publishTelegramChatMemberUpdated: UpdateEventPublisher;
  publishTelegramChatOnlineMemberCountUpdated: UpdateEventPublisher;
  publishTelegramChosenInlineResultReceived: UpdateEventPublisher;
  publishTelegramConnectionState: UpdateEventPublisher;
  publishTelegramCustomEventReceived: UpdateEventPublisher;
  publishTelegramCustomQueryReceived: UpdateEventPublisher;
  publishTelegramDefaultBackgroundUpdated: UpdateEventPublisher;
  publishTelegramDirectMessagesChatTopicUpdated: UpdateEventPublisher;
  publishTelegramEmojiChatThemesUpdated: UpdateEventPublisher;
  publishTelegramFileDownloadRemoved: UpdateEventPublisher;
  publishTelegramFileDownloadUpdated: UpdateEventPublisher;
  publishTelegramFileDownloadsUpdated: UpdateEventPublisher;
  publishTelegramForumTopicInfoUpdated: UpdateEventPublisher;
  publishTelegramForumTopicUpdated: UpdateEventPublisher;
  publishTelegramFreezeStateUpdated: UpdateEventPublisher;
  publishTelegramGiftAuctionStateUpdated: UpdateEventPublisher;
  publishTelegramGroupCallEncryptedParticipantUsersUpdated: UpdateEventPublisher;
  publishTelegramGroupCallMessageCreated: UpdateEventPublisher;
  publishTelegramGroupCallMessageSendFailed: UpdateEventPublisher;
  publishTelegramGroupCallMessagesDeleted: UpdateEventPublisher;
  publishTelegramGroupCallPaidReactionReceived: UpdateEventPublisher;
  publishTelegramGroupCallParticipantUpdatedOrRemoved: UpdateEventPublisher;
  publishTelegramGroupCallUpdated: UpdateEventPublisher;
  publishTelegramGroupCallVerificationStateUpdated: UpdateEventPublisher;
  publishTelegramGuestQueryReceived: UpdateEventPublisher;
  publishTelegramInlineCallbackQueryReceived: UpdateEventPublisher;
  publishTelegramInlineQueryReceived: UpdateEventPublisher;
  publishTelegramLiveStoryTopDonorsUpdated: UpdateEventPublisher;
  publishTelegramManagedBotUpdated: UpdateEventPublisher;
  publishTelegramMessageCreated: UpdateEventPublisher;
  publishTelegramMessageDeleted: UpdateEventPublisher;
  publishTelegramMessageSendFailed: UpdateEventPublisher;
  publishTelegramMessageSendSucceeded: UpdateEventPublisher;
  publishTelegramMessageUpdated: UpdateEventPublisher;
  publishTelegramOauthRequestReceived: UpdateEventPublisher;
  publishTelegramPaidMediaPurchased: UpdateEventPublisher;
  publishTelegramPendingNotificationsUpdated: UpdateEventPublisher;
  publishTelegramPendingTextMessageUpdated: UpdateEventPublisher;
  publishTelegramPollAnswerUpdated: UpdateEventPublisher;
  publishTelegramPollUpdated: UpdateEventPublisher;
  publishTelegramPreCheckoutQueryReceived: UpdateEventPublisher;
  publishTelegramQuickReplyShortcutDeleted: UpdateEventPublisher;
  publishTelegramQuickReplyShortcutMessagesUpdated: UpdateEventPublisher;
  publishTelegramQuickReplyShortcutUpdated: UpdateEventPublisher;
  publishTelegramSavedMessagesTagsUpdated: UpdateEventPublisher;
  publishTelegramSavedMessagesTopicUpdated: UpdateEventPublisher;
  publishTelegramScopeNotificationSettingsUpdated: UpdateEventPublisher;
  publishTelegramServiceNotificationReceived: UpdateEventPublisher;
  publishTelegramShippingQueryReceived: UpdateEventPublisher;
  publishTelegramSpeedLimitNotificationReceived: UpdateEventPublisher;
  publishTelegramStakeDiceStateUpdated: UpdateEventPublisher;
  publishTelegramStoredMessageUpdated: UpdateEventPublisher;
  publishTelegramStoryDeleted: UpdateEventPublisher;
  publishTelegramStoryPostFailed: UpdateEventPublisher;
  publishTelegramStoryPostSucceeded: UpdateEventPublisher;
  publishTelegramStoryStealthModeUpdated: UpdateEventPublisher;
  publishTelegramStoryUpdated: UpdateEventPublisher;
  publishTelegramSuggestedActionsUpdated: UpdateEventPublisher;
  publishTelegramSupergroupUpdated: UpdateEventPublisher;
  publishTelegramTermsOfServiceRequired: UpdateEventPublisher;
  publishTelegramTonRevenueStatusUpdated: UpdateEventPublisher;
  publishTelegramUnconfirmedSessionUpdated: UpdateEventPublisher;
  publishTelegramUnreadChatCountUpdated: UpdateEventPublisher;
  publishTelegramUnreadMessageCountUpdated: UpdateEventPublisher;
  publishTelegramUserFullInfoUpdated: UpdateEventPublisher;
  publishTelegramUserPrivacySettingRulesUpdated: UpdateEventPublisher;
  publishTelegramUserStatusUpdated: UpdateEventPublisher;
  publishTelegramUserUpdated: UpdateEventPublisher;
  publishTelegramWebAppCloseRequested: UpdateEventPublisher;
};

export function createUpdateEvents(events: EventBus): UpdateEvents {
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property !== 'string') {
          return undefined;
        }
        if (!property.startsWith('publish')) {
          return undefined;
        }

        return (...args: unknown[]) => {
          events.publish(eventTypeFromPublisher(property), {
            args
          });
          return Promise.resolve();
        };
      }
    }
  ) as UpdateEvents;
}

function eventTypeFromPublisher(publisher: string): string {
  const rawName = publisher.replace(/^publish/, '');
  const withoutBoundary = rawName.replace(/^Telegram/, '');
  const segments = withoutBoundary
    .replace(/([a-z0-9])([A-Z])/g, '$1.$2')
    .toLowerCase()
    .split('.')
    .filter((segment) => segment.length > 0);

  return ['telegram', 'update', ...segments].join('.');
}
