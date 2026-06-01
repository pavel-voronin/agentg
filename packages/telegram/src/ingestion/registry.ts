import type { IngestionResources } from './resources.js';
import type { IngestionUpdate, UpdateByType } from './types.js';
import { handleUpdateAccentColors } from './update-handlers/updateAccentColors.js';
import { handleUpdateActiveEmojiReactions } from './update-handlers/updateActiveEmojiReactions.js';
import { handleUpdateActiveGiftAuctions } from './update-handlers/updateActiveGiftAuctions.js';
import { handleUpdateActiveLiveLocationMessages } from './update-handlers/updateActiveLiveLocationMessages.js';
import { handleUpdateActiveNotifications } from './update-handlers/updateActiveNotifications.js';
import { handleUpdateAgeVerificationParameters } from './update-handlers/updateAgeVerificationParameters.js';
import { handleUpdateAnimatedEmojiMessageClicked } from './update-handlers/updateAnimatedEmojiMessageClicked.js';
import { handleUpdateAnimationSearchParameters } from './update-handlers/updateAnimationSearchParameters.js';
import { handleUpdateApplicationRecaptchaVerificationRequired } from './update-handlers/updateApplicationRecaptchaVerificationRequired.js';
import { handleUpdateApplicationVerificationRequired } from './update-handlers/updateApplicationVerificationRequired.js';
import { handleUpdateAttachmentMenuBots } from './update-handlers/updateAttachmentMenuBots.js';
import { handleUpdateAuthorizationState } from './update-handlers/updateAuthorizationState.js';
import { handleUpdateAutosaveSettings } from './update-handlers/updateAutosaveSettings.js';
import { handleUpdateAvailableMessageEffects } from './update-handlers/updateAvailableMessageEffects.js';
import { handleUpdateBasicGroup } from './update-handlers/updateBasicGroup.js';
import { handleUpdateBasicGroupFullInfo } from './update-handlers/updateBasicGroupFullInfo.js';
import { handleUpdateBusinessConnection } from './update-handlers/updateBusinessConnection.js';
import { handleUpdateBusinessMessageEdited } from './update-handlers/updateBusinessMessageEdited.js';
import { handleUpdateBusinessMessagesDeleted } from './update-handlers/updateBusinessMessagesDeleted.js';
import { handleUpdateCall } from './update-handlers/updateCall.js';
import { handleUpdateChatAccentColors } from './update-handlers/updateChatAccentColors.js';
import { handleUpdateChatAction } from './update-handlers/updateChatAction.js';
import { handleUpdateChatActionBar } from './update-handlers/updateChatActionBar.js';
import { handleUpdateChatActiveStories } from './update-handlers/updateChatActiveStories.js';
import { handleUpdateChatAddedToList } from './update-handlers/updateChatAddedToList.js';
import { handleUpdateChatAvailableReactions } from './update-handlers/updateChatAvailableReactions.js';
import { handleUpdateChatBackground } from './update-handlers/updateChatBackground.js';
import { handleUpdateChatBlockList } from './update-handlers/updateChatBlockList.js';
import { handleUpdateChatBoost } from './update-handlers/updateChatBoost.js';
import { handleUpdateChatBusinessBotManageBar } from './update-handlers/updateChatBusinessBotManageBar.js';
import { handleUpdateChatDefaultDisableNotification } from './update-handlers/updateChatDefaultDisableNotification.js';
import { handleUpdateChatDraftMessage } from './update-handlers/updateChatDraftMessage.js';
import { handleUpdateChatEmojiStatus } from './update-handlers/updateChatEmojiStatus.js';
import { handleUpdateChatFolders } from './update-handlers/updateChatFolders.js';
import { handleUpdateChatHasProtectedContent } from './update-handlers/updateChatHasProtectedContent.js';
import { handleUpdateChatHasScheduledMessages } from './update-handlers/updateChatHasScheduledMessages.js';
import { handleUpdateChatIsMarkedAsUnread } from './update-handlers/updateChatIsMarkedAsUnread.js';
import { handleUpdateChatIsTranslatable } from './update-handlers/updateChatIsTranslatable.js';
import { handleUpdateChatLastMessage } from './update-handlers/updateChatLastMessage.js';
import { handleUpdateChatMember } from './update-handlers/updateChatMember.js';
import { handleUpdateChatMessageAutoDeleteTime } from './update-handlers/updateChatMessageAutoDeleteTime.js';
import { handleUpdateChatMessageSender } from './update-handlers/updateChatMessageSender.js';
import { handleUpdateChatNotificationSettings } from './update-handlers/updateChatNotificationSettings.js';
import { handleUpdateChatOnlineMemberCount } from './update-handlers/updateChatOnlineMemberCount.js';
import { handleUpdateChatPendingJoinRequests } from './update-handlers/updateChatPendingJoinRequests.js';
import { handleUpdateChatPermissions } from './update-handlers/updateChatPermissions.js';
import { handleUpdateChatPhoto } from './update-handlers/updateChatPhoto.js';
import { handleUpdateChatPosition } from './update-handlers/updateChatPosition.js';
import { handleUpdateChatReadInbox } from './update-handlers/updateChatReadInbox.js';
import { handleUpdateChatReadOutbox } from './update-handlers/updateChatReadOutbox.js';
import { handleUpdateChatRemovedFromList } from './update-handlers/updateChatRemovedFromList.js';
import { handleUpdateChatReplyMarkup } from './update-handlers/updateChatReplyMarkup.js';
import { handleUpdateChatRevenueAmount } from './update-handlers/updateChatRevenueAmount.js';
import { handleUpdateChatTheme } from './update-handlers/updateChatTheme.js';
import { handleUpdateChatTitle } from './update-handlers/updateChatTitle.js';
import { handleUpdateChatUnreadMentionCount } from './update-handlers/updateChatUnreadMentionCount.js';
import { handleUpdateChatUnreadPollVoteCount } from './update-handlers/updateChatUnreadPollVoteCount.js';
import { handleUpdateChatUnreadReactionCount } from './update-handlers/updateChatUnreadReactionCount.js';
import { handleUpdateChatVideoChat } from './update-handlers/updateChatVideoChat.js';
import { handleUpdateChatViewAsTopics } from './update-handlers/updateChatViewAsTopics.js';
import { handleUpdateConnectionState } from './update-handlers/updateConnectionState.js';
import { handleUpdateContactCloseBirthdays } from './update-handlers/updateContactCloseBirthdays.js';
import { handleUpdateDefaultBackground } from './update-handlers/updateDefaultBackground.js';
import { handleUpdateDefaultPaidReactionType } from './update-handlers/updateDefaultPaidReactionType.js';
import { handleUpdateDefaultReactionType } from './update-handlers/updateDefaultReactionType.js';
import { handleUpdateDeleteMessages } from './update-handlers/updateDeleteMessages.js';
import { handleUpdateDiceEmojis } from './update-handlers/updateDiceEmojis.js';
import { handleUpdateDirectMessagesChatTopic } from './update-handlers/updateDirectMessagesChatTopic.js';
import { handleUpdateEmojiChatThemes } from './update-handlers/updateEmojiChatThemes.js';
import { handleUpdateFavoriteStickers } from './update-handlers/updateFavoriteStickers.js';
import { handleUpdateFile } from './update-handlers/updateFile.js';
import { handleUpdateFileAddedToDownloads } from './update-handlers/updateFileAddedToDownloads.js';
import { handleUpdateFileDownload } from './update-handlers/updateFileDownload.js';
import { handleUpdateFileDownloads } from './update-handlers/updateFileDownloads.js';
import { handleUpdateFileGenerationStart } from './update-handlers/updateFileGenerationStart.js';
import { handleUpdateFileGenerationStop } from './update-handlers/updateFileGenerationStop.js';
import { handleUpdateFileRemovedFromDownloads } from './update-handlers/updateFileRemovedFromDownloads.js';
import { handleUpdateForumTopic } from './update-handlers/updateForumTopic.js';
import { handleUpdateForumTopicInfo } from './update-handlers/updateForumTopicInfo.js';
import { handleUpdateFreezeState } from './update-handlers/updateFreezeState.js';
import { handleUpdateGiftAuctionState } from './update-handlers/updateGiftAuctionState.js';
import { handleUpdateGroupCall } from './update-handlers/updateGroupCall.js';
import { handleUpdateGroupCallMessageLevels } from './update-handlers/updateGroupCallMessageLevels.js';
import { handleUpdateGroupCallMessageSendFailed } from './update-handlers/updateGroupCallMessageSendFailed.js';
import { handleUpdateGroupCallMessagesDeleted } from './update-handlers/updateGroupCallMessagesDeleted.js';
import { handleUpdateGroupCallParticipant } from './update-handlers/updateGroupCallParticipant.js';
import { handleUpdateGroupCallParticipants } from './update-handlers/updateGroupCallParticipants.js';
import { handleUpdateGroupCallVerificationState } from './update-handlers/updateGroupCallVerificationState.js';
import { handleUpdateHavePendingNotifications } from './update-handlers/updateHavePendingNotifications.js';
import { handleUpdateInstalledStickerSets } from './update-handlers/updateInstalledStickerSets.js';
import { handleUpdateLanguagePackStrings } from './update-handlers/updateLanguagePackStrings.js';
import { handleUpdateLiveStoryTopDonors } from './update-handlers/updateLiveStoryTopDonors.js';
import { handleUpdateManagedBot } from './update-handlers/updateManagedBot.js';
import { handleUpdateMessageContainsUnreadPollVotes } from './update-handlers/updateMessageContainsUnreadPollVotes.js';
import { handleUpdateMessageContent } from './update-handlers/updateMessageContent.js';
import { handleUpdateMessageContentOpened } from './update-handlers/updateMessageContentOpened.js';
import { handleUpdateMessageEdited } from './update-handlers/updateMessageEdited.js';
import { handleUpdateMessageFactCheck } from './update-handlers/updateMessageFactCheck.js';
import { handleUpdateMessageInteractionInfo } from './update-handlers/updateMessageInteractionInfo.js';
import { handleUpdateMessageIsPinned } from './update-handlers/updateMessageIsPinned.js';
import { handleUpdateMessageLiveLocationViewed } from './update-handlers/updateMessageLiveLocationViewed.js';
import { handleUpdateMessageMentionRead } from './update-handlers/updateMessageMentionRead.js';
import { handleUpdateMessageReaction } from './update-handlers/updateMessageReaction.js';
import { handleUpdateMessageReactions } from './update-handlers/updateMessageReactions.js';
import { handleUpdateMessageSendAcknowledged } from './update-handlers/updateMessageSendAcknowledged.js';
import { handleUpdateMessageSendFailed } from './update-handlers/updateMessageSendFailed.js';
import { handleUpdateMessageSendSucceeded } from './update-handlers/updateMessageSendSucceeded.js';
import { handleUpdateMessageSuggestedPostInfo } from './update-handlers/updateMessageSuggestedPostInfo.js';
import { handleUpdateMessageUnreadReactions } from './update-handlers/updateMessageUnreadReactions.js';
import { handleUpdateNewBusinessCallbackQuery } from './update-handlers/updateNewBusinessCallbackQuery.js';
import { handleUpdateNewBusinessMessage } from './update-handlers/updateNewBusinessMessage.js';
import { handleUpdateNewCallSignalingData } from './update-handlers/updateNewCallSignalingData.js';
import { handleUpdateNewCallbackQuery } from './update-handlers/updateNewCallbackQuery.js';
import { handleUpdateNewChat } from './update-handlers/updateNewChat.js';
import { handleUpdateNewChatJoinRequest } from './update-handlers/updateNewChatJoinRequest.js';
import { handleUpdateNewChosenInlineResult } from './update-handlers/updateNewChosenInlineResult.js';
import { handleUpdateNewCustomEvent } from './update-handlers/updateNewCustomEvent.js';
import { handleUpdateNewCustomQuery } from './update-handlers/updateNewCustomQuery.js';
import { handleUpdateNewGroupCallMessage } from './update-handlers/updateNewGroupCallMessage.js';
import { handleUpdateNewGroupCallPaidReaction } from './update-handlers/updateNewGroupCallPaidReaction.js';
import { handleUpdateNewGuestQuery } from './update-handlers/updateNewGuestQuery.js';
import { handleUpdateNewInlineCallbackQuery } from './update-handlers/updateNewInlineCallbackQuery.js';
import { handleUpdateNewInlineQuery } from './update-handlers/updateNewInlineQuery.js';
import { handleUpdateNewMessage } from './update-handlers/updateNewMessage.js';
import { handleUpdateNewOauthRequest } from './update-handlers/updateNewOauthRequest.js';
import { handleUpdateNewPreCheckoutQuery } from './update-handlers/updateNewPreCheckoutQuery.js';
import { handleUpdateNewShippingQuery } from './update-handlers/updateNewShippingQuery.js';
import { handleUpdateNotification } from './update-handlers/updateNotification.js';
import { handleUpdateNotificationGroup } from './update-handlers/updateNotificationGroup.js';
import { handleUpdateOption } from './update-handlers/updateOption.js';
import { handleUpdateOwnedStarCount } from './update-handlers/updateOwnedStarCount.js';
import { handleUpdateOwnedTonCount } from './update-handlers/updateOwnedTonCount.js';
import { handleUpdatePaidMediaPurchased } from './update-handlers/updatePaidMediaPurchased.js';
import { handleUpdatePendingTextMessage } from './update-handlers/updatePendingTextMessage.js';
import { handleUpdatePoll } from './update-handlers/updatePoll.js';
import { handleUpdatePollAnswer } from './update-handlers/updatePollAnswer.js';
import { handleUpdateProfileAccentColors } from './update-handlers/updateProfileAccentColors.js';
import { handleUpdateQuickReplyShortcut } from './update-handlers/updateQuickReplyShortcut.js';
import { handleUpdateQuickReplyShortcutDeleted } from './update-handlers/updateQuickReplyShortcutDeleted.js';
import { handleUpdateQuickReplyShortcutMessages } from './update-handlers/updateQuickReplyShortcutMessages.js';
import { handleUpdateQuickReplyShortcuts } from './update-handlers/updateQuickReplyShortcuts.js';
import { handleUpdateReactionNotificationSettings } from './update-handlers/updateReactionNotificationSettings.js';
import { handleUpdateRecentStickers } from './update-handlers/updateRecentStickers.js';
import { handleUpdateSavedAnimations } from './update-handlers/updateSavedAnimations.js';
import { handleUpdateSavedMessagesTags } from './update-handlers/updateSavedMessagesTags.js';
import { handleUpdateSavedMessagesTopic } from './update-handlers/updateSavedMessagesTopic.js';
import { handleUpdateSavedMessagesTopicCount } from './update-handlers/updateSavedMessagesTopicCount.js';
import { handleUpdateSavedNotificationSounds } from './update-handlers/updateSavedNotificationSounds.js';
import { handleUpdateScopeNotificationSettings } from './update-handlers/updateScopeNotificationSettings.js';
import { handleUpdateSecretChat } from './update-handlers/updateSecretChat.js';
import { handleUpdateServiceNotification } from './update-handlers/updateServiceNotification.js';
import { handleUpdateSpeechRecognitionTrial } from './update-handlers/updateSpeechRecognitionTrial.js';
import { handleUpdateSpeedLimitNotification } from './update-handlers/updateSpeedLimitNotification.js';
import { handleUpdateStakeDiceState } from './update-handlers/updateStakeDiceState.js';
import { handleUpdateStarRevenueStatus } from './update-handlers/updateStarRevenueStatus.js';
import { handleUpdateStickerSet } from './update-handlers/updateStickerSet.js';
import { handleUpdateStory } from './update-handlers/updateStory.js';
import { handleUpdateStoryDeleted } from './update-handlers/updateStoryDeleted.js';
import { handleUpdateStoryListChatCount } from './update-handlers/updateStoryListChatCount.js';
import { handleUpdateStoryPostFailed } from './update-handlers/updateStoryPostFailed.js';
import { handleUpdateStoryPostSucceeded } from './update-handlers/updateStoryPostSucceeded.js';
import { handleUpdateStoryStealthMode } from './update-handlers/updateStoryStealthMode.js';
import { handleUpdateSuggestedActions } from './update-handlers/updateSuggestedActions.js';
import { handleUpdateSupergroup } from './update-handlers/updateSupergroup.js';
import { handleUpdateSupergroupFullInfo } from './update-handlers/updateSupergroupFullInfo.js';
import { handleUpdateTermsOfService } from './update-handlers/updateTermsOfService.js';
import { handleUpdateTextCompositionStyles } from './update-handlers/updateTextCompositionStyles.js';
import { handleUpdateTonRevenueStatus } from './update-handlers/updateTonRevenueStatus.js';
import { handleUpdateTopicMessageCount } from './update-handlers/updateTopicMessageCount.js';
import { handleUpdateTrendingStickerSets } from './update-handlers/updateTrendingStickerSets.js';
import { handleUpdateTrustedMiniAppBots } from './update-handlers/updateTrustedMiniAppBots.js';
import { handleUpdateUnconfirmedSession } from './update-handlers/updateUnconfirmedSession.js';
import { handleUpdateUnreadChatCount } from './update-handlers/updateUnreadChatCount.js';
import { handleUpdateUnreadMessageCount } from './update-handlers/updateUnreadMessageCount.js';
import { handleUpdateUser } from './update-handlers/updateUser.js';
import { handleUpdateUserFullInfo } from './update-handlers/updateUserFullInfo.js';
import { handleUpdateUserPrivacySettingRules } from './update-handlers/updateUserPrivacySettingRules.js';
import { handleUpdateUserStatus } from './update-handlers/updateUserStatus.js';
import { handleUpdateVideoPublished } from './update-handlers/updateVideoPublished.js';
import { handleUpdateWebAppMessageSent } from './update-handlers/updateWebAppMessageSent.js';

type UpdateHandler<Type extends IngestionUpdate['_']> = (
  update: UpdateByType<Type>,
  resources: IngestionResources
) => Promise<void> | void;

export const updateHandlers = {
  updateAccentColors: handleUpdateAccentColors,
  updateActiveEmojiReactions: handleUpdateActiveEmojiReactions,
  updateActiveGiftAuctions: handleUpdateActiveGiftAuctions,
  updateActiveLiveLocationMessages: handleUpdateActiveLiveLocationMessages,
  updateActiveNotifications: handleUpdateActiveNotifications,
  updateAgeVerificationParameters: handleUpdateAgeVerificationParameters,
  updateAnimatedEmojiMessageClicked: handleUpdateAnimatedEmojiMessageClicked,
  updateAnimationSearchParameters: handleUpdateAnimationSearchParameters,
  updateApplicationRecaptchaVerificationRequired:
    handleUpdateApplicationRecaptchaVerificationRequired,
  updateApplicationVerificationRequired: handleUpdateApplicationVerificationRequired,
  updateAttachmentMenuBots: handleUpdateAttachmentMenuBots,
  updateAuthorizationState: handleUpdateAuthorizationState,
  updateAutosaveSettings: handleUpdateAutosaveSettings,
  updateAvailableMessageEffects: handleUpdateAvailableMessageEffects,
  updateBasicGroup: handleUpdateBasicGroup,
  updateBasicGroupFullInfo: handleUpdateBasicGroupFullInfo,
  updateBusinessConnection: handleUpdateBusinessConnection,
  updateBusinessMessageEdited: handleUpdateBusinessMessageEdited,
  updateBusinessMessagesDeleted: handleUpdateBusinessMessagesDeleted,
  updateCall: handleUpdateCall,
  updateChatAccentColors: handleUpdateChatAccentColors,
  updateChatAction: handleUpdateChatAction,
  updateChatActionBar: handleUpdateChatActionBar,
  updateChatActiveStories: handleUpdateChatActiveStories,
  updateChatAddedToList: handleUpdateChatAddedToList,
  updateChatAvailableReactions: handleUpdateChatAvailableReactions,
  updateChatBackground: handleUpdateChatBackground,
  updateChatBlockList: handleUpdateChatBlockList,
  updateChatBoost: handleUpdateChatBoost,
  updateChatBusinessBotManageBar: handleUpdateChatBusinessBotManageBar,
  updateChatDefaultDisableNotification: handleUpdateChatDefaultDisableNotification,
  updateChatDraftMessage: handleUpdateChatDraftMessage,
  updateChatEmojiStatus: handleUpdateChatEmojiStatus,
  updateChatFolders: handleUpdateChatFolders,
  updateChatHasProtectedContent: handleUpdateChatHasProtectedContent,
  updateChatHasScheduledMessages: handleUpdateChatHasScheduledMessages,
  updateChatIsMarkedAsUnread: handleUpdateChatIsMarkedAsUnread,
  updateChatIsTranslatable: handleUpdateChatIsTranslatable,
  updateChatLastMessage: handleUpdateChatLastMessage,
  updateChatMember: handleUpdateChatMember,
  updateChatMessageAutoDeleteTime: handleUpdateChatMessageAutoDeleteTime,
  updateChatMessageSender: handleUpdateChatMessageSender,
  updateChatNotificationSettings: handleUpdateChatNotificationSettings,
  updateChatOnlineMemberCount: handleUpdateChatOnlineMemberCount,
  updateChatPendingJoinRequests: handleUpdateChatPendingJoinRequests,
  updateChatPermissions: handleUpdateChatPermissions,
  updateChatPhoto: handleUpdateChatPhoto,
  updateChatPosition: handleUpdateChatPosition,
  updateChatReadInbox: handleUpdateChatReadInbox,
  updateChatReadOutbox: handleUpdateChatReadOutbox,
  updateChatRemovedFromList: handleUpdateChatRemovedFromList,
  updateChatReplyMarkup: handleUpdateChatReplyMarkup,
  updateChatRevenueAmount: handleUpdateChatRevenueAmount,
  updateChatTheme: handleUpdateChatTheme,
  updateChatTitle: handleUpdateChatTitle,
  updateChatUnreadMentionCount: handleUpdateChatUnreadMentionCount,
  updateChatUnreadPollVoteCount: handleUpdateChatUnreadPollVoteCount,
  updateChatUnreadReactionCount: handleUpdateChatUnreadReactionCount,
  updateChatVideoChat: handleUpdateChatVideoChat,
  updateChatViewAsTopics: handleUpdateChatViewAsTopics,
  updateConnectionState: handleUpdateConnectionState,
  updateContactCloseBirthdays: handleUpdateContactCloseBirthdays,
  updateDefaultBackground: handleUpdateDefaultBackground,
  updateDefaultPaidReactionType: handleUpdateDefaultPaidReactionType,
  updateDefaultReactionType: handleUpdateDefaultReactionType,
  updateDeleteMessages: handleUpdateDeleteMessages,
  updateDiceEmojis: handleUpdateDiceEmojis,
  updateDirectMessagesChatTopic: handleUpdateDirectMessagesChatTopic,
  updateEmojiChatThemes: handleUpdateEmojiChatThemes,
  updateFavoriteStickers: handleUpdateFavoriteStickers,
  updateFile: handleUpdateFile,
  updateFileAddedToDownloads: handleUpdateFileAddedToDownloads,
  updateFileDownload: handleUpdateFileDownload,
  updateFileDownloads: handleUpdateFileDownloads,
  updateFileGenerationStart: handleUpdateFileGenerationStart,
  updateFileGenerationStop: handleUpdateFileGenerationStop,
  updateFileRemovedFromDownloads: handleUpdateFileRemovedFromDownloads,
  updateForumTopic: handleUpdateForumTopic,
  updateForumTopicInfo: handleUpdateForumTopicInfo,
  updateFreezeState: handleUpdateFreezeState,
  updateGiftAuctionState: handleUpdateGiftAuctionState,
  updateGroupCall: handleUpdateGroupCall,
  updateGroupCallMessageLevels: handleUpdateGroupCallMessageLevels,
  updateGroupCallMessageSendFailed: handleUpdateGroupCallMessageSendFailed,
  updateGroupCallMessagesDeleted: handleUpdateGroupCallMessagesDeleted,
  updateGroupCallParticipant: handleUpdateGroupCallParticipant,
  updateGroupCallParticipants: handleUpdateGroupCallParticipants,
  updateGroupCallVerificationState: handleUpdateGroupCallVerificationState,
  updateHavePendingNotifications: handleUpdateHavePendingNotifications,
  updateInstalledStickerSets: handleUpdateInstalledStickerSets,
  updateLanguagePackStrings: handleUpdateLanguagePackStrings,
  updateLiveStoryTopDonors: handleUpdateLiveStoryTopDonors,
  updateManagedBot: handleUpdateManagedBot,
  updateMessageContainsUnreadPollVotes: handleUpdateMessageContainsUnreadPollVotes,
  updateMessageContent: handleUpdateMessageContent,
  updateMessageContentOpened: handleUpdateMessageContentOpened,
  updateMessageEdited: handleUpdateMessageEdited,
  updateMessageFactCheck: handleUpdateMessageFactCheck,
  updateMessageInteractionInfo: handleUpdateMessageInteractionInfo,
  updateMessageIsPinned: handleUpdateMessageIsPinned,
  updateMessageLiveLocationViewed: handleUpdateMessageLiveLocationViewed,
  updateMessageMentionRead: handleUpdateMessageMentionRead,
  updateMessageReaction: handleUpdateMessageReaction,
  updateMessageReactions: handleUpdateMessageReactions,
  updateMessageSendAcknowledged: handleUpdateMessageSendAcknowledged,
  updateMessageSendFailed: handleUpdateMessageSendFailed,
  updateMessageSendSucceeded: handleUpdateMessageSendSucceeded,
  updateMessageSuggestedPostInfo: handleUpdateMessageSuggestedPostInfo,
  updateMessageUnreadReactions: handleUpdateMessageUnreadReactions,
  updateNewBusinessCallbackQuery: handleUpdateNewBusinessCallbackQuery,
  updateNewBusinessMessage: handleUpdateNewBusinessMessage,
  updateNewCallSignalingData: handleUpdateNewCallSignalingData,
  updateNewCallbackQuery: handleUpdateNewCallbackQuery,
  updateNewChat: handleUpdateNewChat,
  updateNewChatJoinRequest: handleUpdateNewChatJoinRequest,
  updateNewChosenInlineResult: handleUpdateNewChosenInlineResult,
  updateNewCustomEvent: handleUpdateNewCustomEvent,
  updateNewCustomQuery: handleUpdateNewCustomQuery,
  updateNewGroupCallMessage: handleUpdateNewGroupCallMessage,
  updateNewGroupCallPaidReaction: handleUpdateNewGroupCallPaidReaction,
  updateNewGuestQuery: handleUpdateNewGuestQuery,
  updateNewInlineCallbackQuery: handleUpdateNewInlineCallbackQuery,
  updateNewInlineQuery: handleUpdateNewInlineQuery,
  updateNewMessage: handleUpdateNewMessage,
  updateNewOauthRequest: handleUpdateNewOauthRequest,
  updateNewPreCheckoutQuery: handleUpdateNewPreCheckoutQuery,
  updateNewShippingQuery: handleUpdateNewShippingQuery,
  updateNotification: handleUpdateNotification,
  updateNotificationGroup: handleUpdateNotificationGroup,
  updateOption: handleUpdateOption,
  updateOwnedStarCount: handleUpdateOwnedStarCount,
  updateOwnedTonCount: handleUpdateOwnedTonCount,
  updatePaidMediaPurchased: handleUpdatePaidMediaPurchased,
  updatePendingTextMessage: handleUpdatePendingTextMessage,
  updatePoll: handleUpdatePoll,
  updatePollAnswer: handleUpdatePollAnswer,
  updateProfileAccentColors: handleUpdateProfileAccentColors,
  updateQuickReplyShortcut: handleUpdateQuickReplyShortcut,
  updateQuickReplyShortcutDeleted: handleUpdateQuickReplyShortcutDeleted,
  updateQuickReplyShortcutMessages: handleUpdateQuickReplyShortcutMessages,
  updateQuickReplyShortcuts: handleUpdateQuickReplyShortcuts,
  updateReactionNotificationSettings: handleUpdateReactionNotificationSettings,
  updateRecentStickers: handleUpdateRecentStickers,
  updateSavedAnimations: handleUpdateSavedAnimations,
  updateSavedMessagesTags: handleUpdateSavedMessagesTags,
  updateSavedMessagesTopic: handleUpdateSavedMessagesTopic,
  updateSavedMessagesTopicCount: handleUpdateSavedMessagesTopicCount,
  updateSavedNotificationSounds: handleUpdateSavedNotificationSounds,
  updateScopeNotificationSettings: handleUpdateScopeNotificationSettings,
  updateSecretChat: handleUpdateSecretChat,
  updateServiceNotification: handleUpdateServiceNotification,
  updateSpeechRecognitionTrial: handleUpdateSpeechRecognitionTrial,
  updateSpeedLimitNotification: handleUpdateSpeedLimitNotification,
  updateStakeDiceState: handleUpdateStakeDiceState,
  updateStarRevenueStatus: handleUpdateStarRevenueStatus,
  updateStickerSet: handleUpdateStickerSet,
  updateStory: handleUpdateStory,
  updateStoryDeleted: handleUpdateStoryDeleted,
  updateStoryListChatCount: handleUpdateStoryListChatCount,
  updateStoryPostFailed: handleUpdateStoryPostFailed,
  updateStoryPostSucceeded: handleUpdateStoryPostSucceeded,
  updateStoryStealthMode: handleUpdateStoryStealthMode,
  updateSuggestedActions: handleUpdateSuggestedActions,
  updateSupergroup: handleUpdateSupergroup,
  updateSupergroupFullInfo: handleUpdateSupergroupFullInfo,
  updateTermsOfService: handleUpdateTermsOfService,
  updateTextCompositionStyles: handleUpdateTextCompositionStyles,
  updateTonRevenueStatus: handleUpdateTonRevenueStatus,
  updateTopicMessageCount: handleUpdateTopicMessageCount,
  updateTrendingStickerSets: handleUpdateTrendingStickerSets,
  updateTrustedMiniAppBots: handleUpdateTrustedMiniAppBots,
  updateUnconfirmedSession: handleUpdateUnconfirmedSession,
  updateUnreadChatCount: handleUpdateUnreadChatCount,
  updateUnreadMessageCount: handleUpdateUnreadMessageCount,
  updateUser: handleUpdateUser,
  updateUserFullInfo: handleUpdateUserFullInfo,
  updateUserPrivacySettingRules: handleUpdateUserPrivacySettingRules,
  updateUserStatus: handleUpdateUserStatus,
  updateVideoPublished: handleUpdateVideoPublished,
  updateWebAppMessageSent: handleUpdateWebAppMessageSent
} satisfies { [Type in IngestionUpdate['_']]: UpdateHandler<Type> };

export const handledUpdateTypes = Object.freeze(
  Object.keys(updateHandlers).sort()
) as readonly IngestionUpdate['_'][];

type RuntimeUpdate = { readonly _: string };

const runtimeUpdateHandlers = updateHandlers as Record<
  string,
  (nextUpdate: IngestionUpdate, resources: IngestionResources) => Promise<void> | void
>;

export async function persistLiveUpdate(
  update: RuntimeUpdate,
  resources: IngestionResources
): Promise<void> {
  const handler = runtimeUpdateHandlers[update._];
  if (handler === undefined) {
    console.error(
      JSON.stringify({
        event: 'telegram.tdlib_update_unhandled',
        level: 'error',
        updateType: update._
      })
    );
    return;
  }

  await handler(update as IngestionUpdate, resources);
}
