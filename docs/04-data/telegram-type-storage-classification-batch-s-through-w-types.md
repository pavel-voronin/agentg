# Telegram Type Storage Classification Batch: S Through W Types

## Input Types

1. SavedMessagesTopicType
2. ScopeAutosaveSettings
3. ScopeNotificationSettings
4. SecretChat
5. SecretChatState
6. SettingsSection
7. SharedChat
8. SharedUser
9. SpeechRecognitionResult
10. StakeDiceState
11. StarAmount
12. StarRevenueStatus
13. StarSubscriptionPricing
14. Sticker
15. StickerFormat
16. StickerFullType
17. StickerSet
18. StickerSetInfo
19. StickerType
20. Story
21. StoryArea
22. StoryAreaPosition
23. StoryAreaType
24. StoryContent
25. StoryContentType
26. StoryInfo
27. StoryInteractionInfo
28. StoryList
29. StoryOrigin
30. StoryPrivacySettings
31. StoryRepostInfo
32. StoryVideo
33. SuggestedAction
34. SuggestedPostInfo
35. SuggestedPostPrice
36. SuggestedPostRefundReason
37. SuggestedPostState
38. Supergroup
39. SupergroupFullInfo
40. TargetChat
41. TargetChatTypes
42. TermsOfService
43. TextCompositionStyle
44. TextCompositionStyleExample
45. TextEntity
46. TextEntityType
47. TextQuote
48. ThemeSettings
49. Thumbnail
50. ThumbnailFormat
51. TonRevenueStatus
52. TrendingStickerSets
53. UnconfirmedSession
54. UnreadReaction
55. UpgradedGift
56. UpgradedGiftAttributeRarity
57. UpgradedGiftBackdrop
58. UpgradedGiftBackdropColors
59. UpgradedGiftColors
60. UpgradedGiftModel
61. UpgradedGiftOrigin
62. UpgradedGiftOriginalDetails
63. UpgradedGiftSymbol
64. User
65. UserAuctionBid
66. UserFullInfo
67. UserPrivacySetting
68. UserPrivacySettingRule
69. UserPrivacySettingRules
70. UserRating
71. UserStatus
72. UserType
73. Usernames
74. VectorPathCommand
75. Venue
76. VerificationStatus
77. Video
78. VideoChat
79. VideoNote
80. VideoStoryboard
81. VoiceNote
82. WebApp
83. WebAppOpenMode

## Shared Evidence

This batch follows `telegram-type-storage-classification.md` and completes every remaining entry in `tdlib-storage-review.json` that had no storage kind before this run. The batch starts at `SavedMessagesTopicType` and ends at `WebAppOpenMode`; there are no remaining unset storage decisions after the JSON update.

The same decisions are written to `tdlib-storage-review.json` as maturity 2 `storage-decision` review data. The persistent storage target remains the nearest durable owner, account-level key, pair relation, or live event described by the classification framework.

## Decisions

### SavedMessagesTopicType

```text
Type: SavedMessagesTopicType
Storage: embedded
Storage target: SavedMessagesTopic.type
Decision: This is the topic-kind value stored on SavedMessagesTopic. It has no identity outside SavedMessagesTopic.type.
Rejected:
- table: The selected embedded decision stores this shape through SavedMessagesTopic.type; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: savedMessagesTopicTypeAuthorHidden(); savedMessagesTopicTypeMyNotes(); savedMessagesTopicTypeSavedFromChat(chat_id:int53)
- update use: updateSavedMessagesTopic via SavedMessagesTopic
- type use: SavedMessagesTopic.type
- procedures: none
```

### ScopeAutosaveSettings

```text
Type: ScopeAutosaveSettings
Storage: pair
Storage target: AutosaveSettingsScope => ScopeAutosaveSettings
Decision: This is the value side of scoped autosave settings. updateAutosaveSettings and setAutosaveSettings store it only together with an AutosaveSettingsScope key.
Rejected:
- table: The selected pair decision stores this shape through AutosaveSettingsScope => ScopeAutosaveSettings; it does not require its own independently addressed table row.
- embedded: The selected pair decision has a separate storage shape through AutosaveSettingsScope => ScopeAutosaveSettings; treating it as only an owner field would lose the update or identity shape.
- extend: The selected pair decision is not a one-to-one structural extension of a single owner row.
- facet: The selected pair decision is not a separate owner-scoped aspect keyed only by an external owner id.
- kv: The selected pair decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected pair decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: scopeAutosaveSettings(autosave_photos:Bool, autosave_videos:Bool, max_video_file_size:int53)
- update use: updateAutosaveSettings.settings
- type use: AutosaveSettings.channel_settings; AutosaveSettings.group_settings; AutosaveSettings.private_chat_settings; AutosaveSettingsException.settings
- procedures: getAutosaveSettings via AutosaveSettings/AutosaveSettingsException; setAutosaveSettings(settings)
```

### ScopeNotificationSettings

```text
Type: ScopeNotificationSettings
Storage: pair
Storage target: NotificationSettingsScope => ScopeNotificationSettings
Decision: This is the value side of scoped notification settings. updateScopeNotificationSettings, getScopeNotificationSettings, and setScopeNotificationSettings address it by NotificationSettingsScope.
Rejected:
- table: The selected pair decision stores this shape through NotificationSettingsScope => ScopeNotificationSettings; it does not require its own independently addressed table row.
- embedded: The selected pair decision has a separate storage shape through NotificationSettingsScope => ScopeNotificationSettings; treating it as only an owner field would lose the update or identity shape.
- extend: The selected pair decision is not a one-to-one structural extension of a single owner row.
- facet: The selected pair decision is not a separate owner-scoped aspect keyed only by an external owner id.
- kv: The selected pair decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected pair decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: scopeNotificationSettings(mute_for:int32, sound_id:int64, show_preview:Bool, use_default_mute_stories:Bool, mute_stories:Bool, story_sound_id:int64, show_story_poster:Bool, disable_pinned_message_notifications:Bool, disable_mention_notifications:Bool)
- update use: updateScopeNotificationSettings.notification_settings
- type use: none
- procedures: getScopeNotificationSettings -> ScopeNotificationSettings; setScopeNotificationSettings(notification_settings)
```

### SecretChat

```text
Type: SecretChat
Storage: table
Storage target: id
Decision: This is the canonical secret chat row keyed by SecretChat.id. updateSecretChat replaces that row and getSecretChat addresses it by secret_chat_id.
Rejected:
- embedded: The selected table decision has a separate storage shape through id; treating it as only an owner field would lose the update or identity shape.
- extend: The selected table decision is not a one-to-one structural extension of a single owner row.
- facet: The selected table decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected table decision is not stored only as a key/value association between two TDLib types.
- kv: The selected table decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected table decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: secretChat(id:int32, user_id:int53, state:SecretChatState, is_outbound:Bool, key_hash:bytes, layer:int32)
- update use: updateSecretChat.secret_chat
- type use: none
- procedures: getSecretChat -> SecretChat
```

### SecretChatState

```text
Type: SecretChatState
Storage: embedded
Storage target: SecretChat.state
Decision: This is the lifecycle state value of a SecretChat. It has no identity outside SecretChat.state.
Rejected:
- table: The selected embedded decision stores this shape through SecretChat.state; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: secretChatStateClosed(); secretChatStatePending(); secretChatStateReady()
- update use: updateSecretChat via SecretChat
- type use: SecretChat.state
- procedures: getSecretChat via SecretChat
```

### SettingsSection

```text
Type: SettingsSection
Storage: embedded
Storage target: InternalLinkType.section
Decision: This is a settings-navigation selector nested in InternalLinkType. It is routing payload, not durable state with its own lifecycle.
Rejected:
- table: The selected embedded decision stores this shape through InternalLinkType.section; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: settingsSectionAppearance(subsection:string); settingsSectionAskQuestion(); settingsSectionBusiness(subsection:string); settingsSectionChatFolders(subsection:string); settingsSectionDataAndStorage(subsection:string); settingsSectionDevices(subsection:string); settingsSectionEditProfile(subsection:string); settingsSectionFaq(); settingsSectionFeatures(); settingsSectionInAppBrowser(subsection:string); settingsSectionLanguage(subsection:string); settingsSectionMyStars(subsection:string); settingsSectionMyToncoins(); settingsSectionNotifications(subsection:string); settingsSectionPowerSaving(subsection:string); settingsSectionPremium(); settingsSectionPrivacyAndSecurity(subsection:string); settingsSectionPrivacyPolicy(); settingsSectionQrCode(subsection:string); settingsSectionSearch(); settingsSectionSendGift(subsection:string)
- update use: updateActiveLiveLocationMessages via InternalLinkType; updateActiveNotifications via InternalLinkType; updateBusinessMessageEdited via InternalLinkType; updateChatLastMessage via InternalLinkType; updateChatReplyMarkup via InternalLinkType; updateDirectMessagesChatTopic via InternalLinkType; updateFileAddedToDownloads via InternalLinkType; updateMessageEdited via InternalLinkType; updateMessageSendFailed via InternalLinkType; updateMessageSendSucceeded via InternalLinkType; updateNewBusinessCallbackQuery via InternalLinkType; updateNewBusinessMessage via InternalLinkType; updateNewChat via InternalLinkType; updateNewGuestQuery via InternalLinkType; updateNewMessage via InternalLinkType; updateNotification via InternalLinkType; updateNotificationGroup via InternalLinkType; updateQuickReplyShortcut via InternalLinkType; updateQuickReplyShortcutMessages via InternalLinkType; updateSavedMessagesTopic via InternalLinkType; updateUserFullInfo via InternalLinkType
- type use: InternalLinkType.section; botInfo via InternalLinkType; businessMessage via InternalLinkType; businessMessages via InternalLinkType; chat via InternalLinkType; chatEvent via InternalLinkType; chatEventMessageDeleted via InternalLinkType; chatEventMessageEdited via InternalLinkType; chatEventMessagePinned via InternalLinkType; chatEventMessageUnpinned via InternalLinkType; chatEventPollStopped via InternalLinkType; chatEvents via InternalLinkType; directMessagesChatTopic via InternalLinkType; fileDownload via InternalLinkType; forumTopic via InternalLinkType; forumTopics via InternalLinkType; foundChatMessages via InternalLinkType; foundFileDownloads via InternalLinkType; foundMessages via InternalLinkType; foundPublicPosts via InternalLinkType; inlineKeyboardButton via InternalLinkType; inlineKeyboardButtonTypeSwitchInline via InternalLinkType; inputInlineQueryResultAnimation via InternalLinkType; inputInlineQueryResultArticle via InternalLinkType; inputInlineQueryResultAudio via InternalLinkType; plus 36 more schema references
- procedures: addLocalMessage via InternalLinkType; addOffer via InternalLinkType; addQuickReplyShortcutInlineQueryResultMessage via InternalLinkType; addQuickReplyShortcutMessage via InternalLinkType; addQuickReplyShortcutMessageAlbum via InternalLinkType; answerGuestQuery via InternalLinkType; answerInlineQuery via InternalLinkType; answerWebAppQuery via InternalLinkType; createBasicGroupChat via InternalLinkType; createNewSecretChat via InternalLinkType; createNewSupergroupChat via InternalLinkType; createPrivateChat via InternalLinkType; createSecretChat via InternalLinkType; createSupergroupChat via InternalLinkType; editBusinessMessageCaption via InternalLinkType; editBusinessMessageChecklist via InternalLinkType; editBusinessMessageLiveLocation via InternalLinkType; editBusinessMessageMedia via InternalLinkType; editBusinessMessageReplyMarkup via InternalLinkType; editBusinessMessageText via InternalLinkType; editInlineMessageCaption via InternalLinkType; editInlineMessageLiveLocation via InternalLinkType; editInlineMessageMedia via InternalLinkType; editInlineMessageReplyMarkup via InternalLinkType; editInlineMessageText via InternalLinkType; editMessageCaption via InternalLinkType; editMessageChecklist via InternalLinkType; editMessageLiveLocation via InternalLinkType; editMessageMedia via InternalLinkType; editMessageReplyMarkup via InternalLinkType; editMessageText via InternalLinkType; forwardMessages via InternalLinkType; getCallbackQueryMessage via InternalLinkType; getChat via InternalLinkType; getChatEventLog via InternalLinkType; getChatHistory via InternalLinkType; plus 57 more schema references
```

### SharedChat

```text
Type: SharedChat
Storage: embedded
Storage target: MessageContent.chat
Decision: This is the chat payload inside messageChatShared content. The stored owner is the message content field, while chat_id is a reference to Chat.
Rejected:
- table: The selected embedded decision stores this shape through MessageContent.chat; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: sharedChat(chat_id:int53, title:string, username:string, photo:photo)
- update use: updateActiveLiveLocationMessages via MessageContent; updateActiveNotifications via MessageContent; updateBusinessMessageEdited via MessageContent; updateChatLastMessage via MessageContent; updateChatReplyMarkup via MessageContent; updateDirectMessagesChatTopic via MessageContent; updateFileAddedToDownloads via MessageContent; updateMessageContent via MessageContent; updateMessageSendFailed via MessageContent; updateMessageSendSucceeded via MessageContent; updateNewBusinessCallbackQuery via MessageContent; updateNewBusinessMessage via MessageContent; updateNewChat via MessageContent; updateNewGuestQuery via MessageContent; updateNewMessage via MessageContent; updateNotification via MessageContent; updateNotificationGroup via MessageContent; updatePoll via MessageContent; updateQuickReplyShortcut via MessageContent; updateQuickReplyShortcutMessages via MessageContent; updateSavedMessagesTopic via MessageContent; updateServiceNotification via MessageContent
- type use: MessageContent.chat; businessMessage via MessageContent; businessMessages via MessageContent; chat via MessageContent; chatEvent via MessageContent; chatEventMessageDeleted via MessageContent; chatEventMessageEdited via MessageContent; chatEventMessagePinned via MessageContent; chatEventMessageUnpinned via MessageContent; chatEventPollStopped via MessageContent; chatEvents via MessageContent; directMessagesChatTopic via MessageContent; fileDownload via MessageContent; forumTopic via MessageContent; forumTopics via MessageContent; foundChatMessages via MessageContent; foundFileDownloads via MessageContent; foundMessages via MessageContent; foundPublicPosts via MessageContent; message via MessageContent; messageCalendar via MessageContent; messageCalendarDay via MessageContent; messageLinkInfo via MessageContent; messagePoll via MessageContent; messageReplyToMessage via MessageContent; plus 19 more schema references
- procedures: addLocalMessage via MessageContent; addOffer via MessageContent; addQuickReplyShortcutInlineQueryResultMessage via MessageContent; addQuickReplyShortcutMessage via MessageContent; addQuickReplyShortcutMessageAlbum via MessageContent; createBasicGroupChat via MessageContent; createNewSecretChat via MessageContent; createNewSupergroupChat via MessageContent; createPrivateChat via MessageContent; createSecretChat via MessageContent; createSupergroupChat via MessageContent; editBusinessMessageCaption via MessageContent; editBusinessMessageChecklist via MessageContent; editBusinessMessageLiveLocation via MessageContent; editBusinessMessageMedia via MessageContent; editBusinessMessageReplyMarkup via MessageContent; editBusinessMessageText via MessageContent; editMessageCaption via MessageContent; editMessageChecklist via MessageContent; editMessageLiveLocation via MessageContent; editMessageMedia via MessageContent; editMessageReplyMarkup via MessageContent; editMessageText via MessageContent; forwardMessages via MessageContent; getCallbackQueryMessage via MessageContent; getChat via MessageContent; getChatEventLog via MessageContent; getChatHistory via MessageContent; getChatMessageByDate via MessageContent; getChatMessageCalendar via MessageContent; getChatPinnedMessage via MessageContent; getChatScheduledMessages via MessageContent; getChatSponsoredMessages via MessageContent; getChatStoryInteractions via MessageContent; getDirectMessagesChatTopic via MessageContent; getDirectMessagesChatTopicHistory via MessageContent; plus 42 more schema references
```

### SharedUser

```text
Type: SharedUser
Storage: embedded
Storage target: MessageContent.users
Decision: This is one shared-user payload inside messageUsersShared content. The stored owner is the message content field, while user_id is a reference to User.
Rejected:
- table: The selected embedded decision stores this shape through MessageContent.users; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: sharedUser(user_id:int53, first_name:string, last_name:string, username:string, photo:photo)
- update use: updateActiveLiveLocationMessages via MessageContent; updateActiveNotifications via MessageContent; updateBusinessMessageEdited via MessageContent; updateChatLastMessage via MessageContent; updateChatReplyMarkup via MessageContent; updateDirectMessagesChatTopic via MessageContent; updateFileAddedToDownloads via MessageContent; updateMessageContent via MessageContent; updateMessageSendFailed via MessageContent; updateMessageSendSucceeded via MessageContent; updateNewBusinessCallbackQuery via MessageContent; updateNewBusinessMessage via MessageContent; updateNewChat via MessageContent; updateNewGuestQuery via MessageContent; updateNewMessage via MessageContent; updateNotification via MessageContent; updateNotificationGroup via MessageContent; updatePoll via MessageContent; updateQuickReplyShortcut via MessageContent; updateQuickReplyShortcutMessages via MessageContent; updateSavedMessagesTopic via MessageContent; updateServiceNotification via MessageContent
- type use: MessageContent.users; businessMessage via MessageContent; businessMessages via MessageContent; chat via MessageContent; chatEvent via MessageContent; chatEventMessageDeleted via MessageContent; chatEventMessageEdited via MessageContent; chatEventMessagePinned via MessageContent; chatEventMessageUnpinned via MessageContent; chatEventPollStopped via MessageContent; chatEvents via MessageContent; directMessagesChatTopic via MessageContent; fileDownload via MessageContent; forumTopic via MessageContent; forumTopics via MessageContent; foundChatMessages via MessageContent; foundFileDownloads via MessageContent; foundMessages via MessageContent; foundPublicPosts via MessageContent; message via MessageContent; messageCalendar via MessageContent; messageCalendarDay via MessageContent; messageLinkInfo via MessageContent; messagePoll via MessageContent; messageReplyToMessage via MessageContent; plus 19 more schema references
- procedures: addLocalMessage via MessageContent; addOffer via MessageContent; addQuickReplyShortcutInlineQueryResultMessage via MessageContent; addQuickReplyShortcutMessage via MessageContent; addQuickReplyShortcutMessageAlbum via MessageContent; createBasicGroupChat via MessageContent; createNewSecretChat via MessageContent; createNewSupergroupChat via MessageContent; createPrivateChat via MessageContent; createSecretChat via MessageContent; createSupergroupChat via MessageContent; editBusinessMessageCaption via MessageContent; editBusinessMessageChecklist via MessageContent; editBusinessMessageLiveLocation via MessageContent; editBusinessMessageMedia via MessageContent; editBusinessMessageReplyMarkup via MessageContent; editBusinessMessageText via MessageContent; editMessageCaption via MessageContent; editMessageChecklist via MessageContent; editMessageLiveLocation via MessageContent; editMessageMedia via MessageContent; editMessageReplyMarkup via MessageContent; editMessageText via MessageContent; forwardMessages via MessageContent; getCallbackQueryMessage via MessageContent; getChat via MessageContent; getChatEventLog via MessageContent; getChatHistory via MessageContent; getChatMessageByDate via MessageContent; getChatMessageCalendar via MessageContent; getChatPinnedMessage via MessageContent; getChatScheduledMessages via MessageContent; getChatSponsoredMessages via MessageContent; getChatStoryInteractions via MessageContent; getDirectMessagesChatTopic via MessageContent; getDirectMessagesChatTopicHistory via MessageContent; plus 42 more schema references
```

### SpeechRecognitionResult

```text
Type: SpeechRecognitionResult
Storage: embedded
Storage target: VideoNote.speech_recognition_result, VoiceNote.speech_recognition_result
Decision: This is speech-recognition status or text attached to a video note or voice note. It has no identity outside the owning media payload.
Rejected:
- table: The selected embedded decision stores this shape through VideoNote.speech_recognition_result, VoiceNote.speech_recognition_result; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: speechRecognitionResultError(error:error); speechRecognitionResultPending(partial_text:string); speechRecognitionResultText(text:string)
- update use: updateActiveLiveLocationMessages via VideoNote/VoiceNote; updateActiveNotifications via VideoNote/VoiceNote; updateBusinessMessageEdited via VideoNote/VoiceNote; updateChatLastMessage via VideoNote/VoiceNote; updateChatReplyMarkup via VideoNote/VoiceNote; updateDirectMessagesChatTopic via VideoNote/VoiceNote; updateFileAddedToDownloads via VideoNote/VoiceNote; updateMessageContent via VideoNote/VoiceNote; updateMessageSendFailed via VideoNote/VoiceNote; updateMessageSendSucceeded via VideoNote/VoiceNote; updateNewBusinessCallbackQuery via VideoNote/VoiceNote; updateNewBusinessMessage via VideoNote/VoiceNote; updateNewChat via VideoNote/VoiceNote; updateNewGuestQuery via VideoNote/VoiceNote; updateNewMessage via VideoNote/VoiceNote; updateNotification via VideoNote/VoiceNote; updateNotificationGroup via VideoNote/VoiceNote; updatePoll via VideoNote/VoiceNote; updateQuickReplyShortcut via VideoNote/VoiceNote; updateQuickReplyShortcutMessages via VideoNote/VoiceNote; updateSavedMessagesTopic via VideoNote/VoiceNote; updateServiceNotification via VideoNote/VoiceNote
- type use: VideoNote.speech_recognition_result; VoiceNote.speech_recognition_result; businessMessage via VideoNote/VoiceNote; businessMessages via VideoNote/VoiceNote; chat via VideoNote/VoiceNote; chatEvent via VideoNote/VoiceNote; chatEventMessageDeleted via VideoNote/VoiceNote; chatEventMessageEdited via VideoNote/VoiceNote; chatEventMessagePinned via VideoNote/VoiceNote; chatEventMessageUnpinned via VideoNote/VoiceNote; chatEventPollStopped via VideoNote/VoiceNote; chatEvents via VideoNote/VoiceNote; directMessagesChatTopic via VideoNote/VoiceNote; fileDownload via VideoNote/VoiceNote; forumTopic via VideoNote/VoiceNote; forumTopics via VideoNote/VoiceNote; foundChatMessages via VideoNote/VoiceNote; foundFileDownloads via VideoNote/VoiceNote; foundMessages via VideoNote/VoiceNote; foundPublicPosts via VideoNote/VoiceNote; inlineQueryResultVoiceNote via VoiceNote; inlineQueryResults via VoiceNote; linkPreview via VideoNote/VoiceNote; linkPreviewTypeVideoNote via VideoNote; linkPreviewTypeVoiceNote via VoiceNote; message via VideoNote/VoiceNote; plus 40 more schema references
- procedures: addLocalMessage via VideoNote/VoiceNote; addOffer via VideoNote/VoiceNote; addQuickReplyShortcutInlineQueryResultMessage via VideoNote/VoiceNote; addQuickReplyShortcutMessage via VideoNote/VoiceNote; addQuickReplyShortcutMessageAlbum via VideoNote/VoiceNote; createBasicGroupChat via VideoNote/VoiceNote; createNewSecretChat via VideoNote/VoiceNote; createNewSupergroupChat via VideoNote/VoiceNote; createPrivateChat via VideoNote/VoiceNote; createSecretChat via VideoNote/VoiceNote; createSupergroupChat via VideoNote/VoiceNote; editBusinessMessageCaption via VideoNote/VoiceNote; editBusinessMessageChecklist via VideoNote/VoiceNote; editBusinessMessageLiveLocation via VideoNote/VoiceNote; editBusinessMessageMedia via VideoNote/VoiceNote; editBusinessMessageReplyMarkup via VideoNote/VoiceNote; editBusinessMessageText via VideoNote/VoiceNote; editMessageCaption via VideoNote/VoiceNote; editMessageChecklist via VideoNote/VoiceNote; editMessageLiveLocation via VideoNote/VoiceNote; editMessageMedia via VideoNote/VoiceNote; editMessageReplyMarkup via VideoNote/VoiceNote; editMessageText via VideoNote/VoiceNote; forwardMessages via VideoNote/VoiceNote; getCallbackQueryMessage via VideoNote/VoiceNote; getChat via VideoNote/VoiceNote; getChatEventLog via VideoNote/VoiceNote; getChatHistory via VideoNote/VoiceNote; getChatMessageByDate via VideoNote/VoiceNote; getChatMessageCalendar via VideoNote/VoiceNote; getChatPinnedMessage via VideoNote/VoiceNote; getChatScheduledMessages via VideoNote/VoiceNote; getChatSponsoredMessages via VideoNote/VoiceNote; getChatStoryInteractions via VideoNote/VoiceNote; getDirectMessagesChatTopic via VideoNote/VoiceNote; getDirectMessagesChatTopicHistory via VideoNote/VoiceNote; plus 46 more schema references
```

### StakeDiceState

```text
Type: StakeDiceState
Storage: event
Storage target: stake_dice_state
Decision: This is a short-lived stake dice state delivered by updateStakeDiceState and refreshed by getStakeDiceState. TDLib marks received state as usable only while recent, so persisting it as durable state would make stale sends possible after restart.
Rejected:
- table: The selected event decision stores this shape through stake_dice_state; it does not require its own independently addressed table row.
- embedded: The selected event decision has a separate storage shape through stake_dice_state; treating it as only an owner field would lose the update or identity shape.
- extend: The selected event decision is not a one-to-one structural extension of a single owner row.
- facet: The selected event decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected event decision is not stored only as a key/value association between two TDLib types.
- kv: The selected event decision is not a singleton account/global value keyed only by a stable domain name.
Evidence:
- constructors: stakeDiceState(state_hash:string, stake_toncoin_amount:int53, suggested_stake_toncoin_amounts:vector<int53>, current_streak:int32, prize_per_mille:vector<int32>, streak_prize_per_mille:int32)
- update use: updateStakeDiceState.state
- type use: none
- procedures: getStakeDiceState -> StakeDiceState
```

### StarAmount

```text
Type: StarAmount
Storage: embedded
Storage target: owned_star_count, AffiliateInfo.star_amount, AffiliateProgramInfo.daily_revenue_per_user_amount, MessageContent.star_amount, StarRevenueStatus.total_amount, StarRevenueStatus.current_amount, StarRevenueStatus.available_amount, StarSubscriptions.star_amount, StarTransaction.star_amount, StarTransactions.star_amount, StarTransactionType.commission_star_amount
Decision: This is a reusable Telegram Stars amount value. updateOwnedStarCount and revenue, transaction, affiliate, subscription, and message owners store the amount as a field value, not as an independently addressed row.
Rejected:
- table: The selected embedded decision stores this shape through owned_star_count, AffiliateInfo.star_amount, AffiliateProgramInfo.daily_revenue_per_user_amount, MessageContent.star_amount, StarRevenueStatus.total_amount, StarRevenueStatus.current_amount, StarRevenueStatus.available_amount, StarSubscriptions.star_amount, StarTransaction.star_amount, StarTransactions.star_amount, StarTransactionType.commission_star_amount; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: starAmount(star_count:int53, nanostar_count:int32)
- update use: updateOwnedStarCount.star_amount; updateActiveLiveLocationMessages via MessageContent; updateActiveNotifications via MessageContent; updateBusinessMessageEdited via MessageContent; updateChatLastMessage via MessageContent; updateChatReplyMarkup via MessageContent; updateDirectMessagesChatTopic via MessageContent; updateFileAddedToDownloads via MessageContent; updateMessageContent via MessageContent; updateMessageSendFailed via MessageContent; updateMessageSendSucceeded via MessageContent; updateNewBusinessCallbackQuery via MessageContent; updateNewBusinessMessage via MessageContent; updateNewChat via MessageContent; updateNewGuestQuery via MessageContent; updateNewMessage via MessageContent; updateNotification via MessageContent; updateNotificationGroup via MessageContent; updatePoll via MessageContent; updateQuickReplyShortcut via MessageContent; updateQuickReplyShortcutMessages via MessageContent; updateSavedMessagesTopic via MessageContent; updateServiceNotification via MessageContent; updateStarRevenueStatus via StarRevenueStatus; updateUserFullInfo via AffiliateProgramInfo
- type use: AffiliateInfo.star_amount; AffiliateProgramInfo.daily_revenue_per_user_amount; MessageContent.star_amount; StarRevenueStatus.available_amount; StarRevenueStatus.current_amount; StarRevenueStatus.total_amount; StarSubscriptions.star_amount; StarTransaction.star_amount; StarTransactionType.commission_star_amount; StarTransactions.star_amount; botInfo via AffiliateProgramInfo; businessMessage via MessageContent; businessMessages via MessageContent; chat via MessageContent; chatEvent via MessageContent; chatEventMessageDeleted via MessageContent; chatEventMessageEdited via MessageContent; chatEventMessagePinned via MessageContent; chatEventMessageUnpinned via MessageContent; chatEventPollStopped via MessageContent; chatEvents via MessageContent; directMessagesChatTopic via MessageContent; fileDownload via MessageContent; forumTopic via MessageContent; forumTopics via MessageContent; foundAffiliateProgram via AffiliateProgramInfo; foundAffiliatePrograms via AffiliateProgramInfo; foundChatMessages via MessageContent; foundFileDownloads via MessageContent; foundMessages via MessageContent; foundPublicPosts via MessageContent; message via MessageContent; messageCalendar via MessageContent; messageCalendarDay via MessageContent; plus 27 more schema references
- procedures: addLocalMessage via MessageContent; addOffer via MessageContent; addQuickReplyShortcutInlineQueryResultMessage via MessageContent; addQuickReplyShortcutMessage via MessageContent; addQuickReplyShortcutMessageAlbum via MessageContent; createBasicGroupChat via MessageContent; createNewSecretChat via MessageContent; createNewSupergroupChat via MessageContent; createPrivateChat via MessageContent; createSecretChat via MessageContent; createSupergroupChat via MessageContent; editBusinessMessageCaption via MessageContent; editBusinessMessageChecklist via MessageContent; editBusinessMessageLiveLocation via MessageContent; editBusinessMessageMedia via MessageContent; editBusinessMessageReplyMarkup via MessageContent; editBusinessMessageText via MessageContent; editMessageCaption via MessageContent; editMessageChecklist via MessageContent; editMessageLiveLocation via MessageContent; editMessageMedia via MessageContent; editMessageReplyMarkup via MessageContent; editMessageText via MessageContent; forwardMessages via MessageContent; getBusinessAccountStarAmount -> StarAmount; getCallbackQueryMessage via MessageContent; getChat via MessageContent; getChatEventLog via MessageContent; getChatHistory via MessageContent; getChatMessageByDate via MessageContent; getChatMessageCalendar via MessageContent; getChatPinnedMessage via MessageContent; getChatScheduledMessages via MessageContent; getChatSponsoredMessages via MessageContent; getChatStoryInteractions via MessageContent; getDirectMessagesChatTopic via MessageContent; plus 48 more schema references
```

### StarRevenueStatus

```text
Type: StarRevenueStatus
Storage: facet
Storage target: owner_id = MessageSender
Decision: This is current Telegram Stars revenue status for a MessageSender owner. updateStarRevenueStatus supplies owner_id externally and replaces the owner-scoped status.
Rejected:
- table: The selected facet decision stores this shape through owner_id = MessageSender; it does not require its own independently addressed table row.
- embedded: The selected facet decision has a separate storage shape through owner_id = MessageSender; treating it as only an owner field would lose the update or identity shape.
- extend: The selected facet decision is not a one-to-one structural extension of a single owner row.
- pair: The selected facet decision is not stored only as a key/value association between two TDLib types.
- kv: The selected facet decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected facet decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: starRevenueStatus(total_amount:starAmount, current_amount:starAmount, available_amount:starAmount, withdrawal_enabled:Bool, next_withdrawal_in:int32)
- update use: updateStarRevenueStatus.status
- type use: StarRevenueStatistics.status
- procedures: getStarRevenueStatistics via StarRevenueStatistics
```

### StarSubscriptionPricing

```text
Type: StarSubscriptionPricing
Storage: embedded
Storage target: ChatInviteLink.subscription_pricing, ChatInviteLinkSubscriptionInfo.pricing, PaymentFormType.pricing, StarSubscription.pricing
Decision: This is subscription price metadata embedded in invite links, payment forms, and star subscription payloads. It has no lifecycle outside those owner fields.
Rejected:
- table: The selected embedded decision stores this shape through ChatInviteLink.subscription_pricing, ChatInviteLinkSubscriptionInfo.pricing, PaymentFormType.pricing, StarSubscription.pricing; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: starSubscriptionPricing(period:int32, star_count:int53)
- update use: updateBasicGroupFullInfo via ChatInviteLink; updateChatMember via ChatInviteLink; updateNewChatJoinRequest via ChatInviteLink; updateSupergroupFullInfo via ChatInviteLink
- type use: ChatInviteLink.subscription_pricing; ChatInviteLinkSubscriptionInfo.pricing; PaymentFormType.pricing; StarSubscription.pricing; basicGroupFullInfo via ChatInviteLink; chatEvent via ChatInviteLink; chatEventInviteLinkDeleted via ChatInviteLink; chatEventInviteLinkEdited via ChatInviteLink; chatEventInviteLinkRevoked via ChatInviteLink; chatEventMemberJoinedByInviteLink via ChatInviteLink; chatEventMemberJoinedByRequest via ChatInviteLink; chatEvents via ChatInviteLink; chatInviteLinkInfo via ChatInviteLinkSubscriptionInfo; chatInviteLinks via ChatInviteLink; paymentForm via PaymentFormType; starSubscriptions via StarSubscription; supergroupFullInfo via ChatInviteLink; tMeUrl via ChatInviteLinkSubscriptionInfo; tMeUrlTypeChatInvite via ChatInviteLinkSubscriptionInfo; tMeUrls via ChatInviteLinkSubscriptionInfo
- procedures: checkChatInviteLink via ChatInviteLinkSubscriptionInfo; createChatInviteLink via ChatInviteLink; createChatSubscriptionInviteLink(subscription_pricing); editChatInviteLink via ChatInviteLink; editChatSubscriptionInviteLink via ChatInviteLink; getBasicGroupFullInfo via ChatInviteLink; getChatEventLog via ChatInviteLink; getChatInviteLink via ChatInviteLink; getChatInviteLinks via ChatInviteLink; getPaymentForm via PaymentFormType; getRecentlyVisitedTMeUrls via ChatInviteLinkSubscriptionInfo; getStarSubscriptions via StarSubscription; getSupergroupFullInfo via ChatInviteLink; replacePrimaryChatInviteLink via ChatInviteLink; revokeChatInviteLink via ChatInviteLink
```

### Sticker

```text
Type: Sticker
Storage: table
Storage target: id
Decision: This is the canonical sticker entity keyed by Sticker.id. Sticker sets, messages, gifts, reactions, and sticker procedures can reference the same sticker payload, so owners should store references to the sticker row.
Rejected:
- embedded: The selected table decision has a separate storage shape through id; treating it as only an owner field would lose the update or identity shape.
- extend: The selected table decision is not a one-to-one structural extension of a single owner row.
- facet: The selected table decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected table decision is not stored only as a key/value association between two TDLib types.
- kv: The selected table decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected table decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: sticker(id:int64, set_id:int64, width:int32, height:int32, emoji:string, format:StickerFormat, full_type:StickerFullType, thumbnail:thumbnail, sticker:file)
- update use: updateAnimatedEmojiMessageClicked.sticker; updateActiveGiftAuctions via Gift; updateActiveLiveLocationMessages via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updateActiveNotifications via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/PushMessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updateBusinessMessageEdited via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updateChatLastMessage via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updateChatReplyMarkup via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updateChatTheme via UpgradedGiftModel/UpgradedGiftSymbol; updateDirectMessagesChatTopic via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updateFileAddedToDownloads via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updateGiftAuctionState via Gift; updateMessageContent via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updateMessageSendFailed via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updateMessageSendSucceeded via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updateNewBusinessCallbackQuery via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updateNewBusinessMessage via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updateNewChat via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updateNewGuestQuery via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updateNewMessage via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updateNotification via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/PushMessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updateNotificationGroup via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/PushMessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updatePoll via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updateQuickReplyShortcut via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updateQuickReplyShortcutMessages via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; updateSavedMessagesTopic via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; plus 4 more schema references
- type use: AnimatedEmoji.sticker; BusinessStartPage.sticker; DiceStickers.background; DiceStickers.center_reel; DiceStickers.left_reel; DiceStickers.lever; DiceStickers.right_reel; DiceStickers.sticker; EmojiCategory.icon; EmojiReaction.activate_animation; EmojiReaction.appear_animation; EmojiReaction.around_animation; EmojiReaction.center_animation; EmojiReaction.effect_animation; EmojiReaction.select_animation; EmojiReaction.static_icon; Gift.sticker; GiftCollection.icon; InlineQueryResult.sticker; LinkPreviewType.icons; LinkPreviewType.sticker; LinkPreviewType.stickers; MessageContent.sticker; MessageEffect.static_icon; plus 12 more schema references; availableGift via Gift; availableGifts via Gift; businessInfo via BusinessStartPage; businessMessage via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; businessMessages via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; chat via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; chatEvent via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; chatEventMessageDeleted via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; chatEventMessageEdited via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; chatEventMessagePinned via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; chatEventMessageUnpinned via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; chatEventPollStopped via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; chatEvents via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; chatThemeGift via UpgradedGiftModel/UpgradedGiftSymbol; craftGiftResultSuccess via UpgradedGiftModel/UpgradedGiftSymbol; directMessagesChatTopic via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; emojiCategories via EmojiCategory; fileDownload via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; forumTopic via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; forumTopics via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; foundChatMessages via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; foundFileDownloads via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; foundMessages via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; foundPublicPosts via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; plus 79 more schema references
- procedures: addGiftCollectionGifts via GiftCollection; addLocalMessage via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; addOffer via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; addQuickReplyShortcutInlineQueryResultMessage via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; addQuickReplyShortcutMessage via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; addQuickReplyShortcutMessageAlbum via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; addRecentSticker via Stickers; clickAnimatedEmojiMessage -> Sticker; craftGift via UpgradedGiftModel/UpgradedGiftSymbol; createBasicGroupChat via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; createGiftCollection via GiftCollection; createNewSecretChat via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; createNewStickerSet via StickerSet; createNewSupergroupChat via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; createPrivateChat via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; createSecretChat via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; createSupergroupChat via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; editBusinessMessageCaption via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; editBusinessMessageChecklist via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; editBusinessMessageLiveLocation via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; editBusinessMessageMedia via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; editBusinessMessageReplyMarkup via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; editBusinessMessageText via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; editMessageCaption via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; editMessageChecklist via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; editMessageLiveLocation via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; editMessageMedia via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; editMessageReplyMarkup via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; editMessageText via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; forwardMessages via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; getAnimatedEmoji via AnimatedEmoji; getArchivedStickerSets via StickerSetInfo; getAttachedStickerSets via StickerSetInfo; getAvailableGifts via Gift; getCallbackQueryMessage via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; getChat via AnimatedEmoji/DiceStickers/Gift/LinkPreviewType/MessageContent/UpgradedGiftModel/UpgradedGiftSymbol; plus 97 more schema references
```

### StickerFormat

```text
Type: StickerFormat
Storage: embedded
Storage target: InputSticker.format, Sticker.format
Decision: This is the file-format value for input and stored stickers. It has no identity outside the owning sticker payload.
Rejected:
- table: The selected embedded decision stores this shape through InputSticker.format, Sticker.format; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: stickerFormatTgs(); stickerFormatWebm(); stickerFormatWebp()
- update use: updateActiveGiftAuctions via Sticker; updateActiveLiveLocationMessages via Sticker; updateActiveNotifications via Sticker; updateAnimatedEmojiMessageClicked via Sticker; updateBusinessMessageEdited via Sticker; updateChatLastMessage via Sticker; updateChatReplyMarkup via Sticker; updateChatTheme via Sticker; updateDirectMessagesChatTopic via Sticker; updateFileAddedToDownloads via Sticker; updateGiftAuctionState via Sticker; updateMessageContent via Sticker; updateMessageSendFailed via Sticker; updateMessageSendSucceeded via Sticker; updateNewBusinessCallbackQuery via Sticker; updateNewBusinessMessage via Sticker; updateNewChat via Sticker; updateNewGuestQuery via Sticker; updateNewMessage via Sticker; updateNotification via Sticker; updateNotificationGroup via Sticker; updatePoll via Sticker; updateQuickReplyShortcut via Sticker; updateQuickReplyShortcutMessages via Sticker; plus 5 more schema references
- type use: InputSticker.format; Sticker.format; animatedEmoji via Sticker; availableGift via Sticker; availableGifts via Sticker; businessInfo via Sticker; businessMessage via Sticker; businessMessages via Sticker; businessStartPage via Sticker; chat via Sticker; chatEvent via Sticker; chatEventMessageDeleted via Sticker; chatEventMessageEdited via Sticker; chatEventMessagePinned via Sticker; chatEventMessageUnpinned via Sticker; chatEventPollStopped via Sticker; chatEvents via Sticker; chatThemeGift via Sticker; craftGiftResultSuccess via Sticker; diceStickersRegular via Sticker; diceStickersSlotMachine via Sticker; directMessagesChatTopic via Sticker; emojiCategories via Sticker; emojiCategory via Sticker; emojiReaction via Sticker; fileDownload via Sticker; plus 111 more schema references
- procedures: addGiftCollectionGifts via Sticker; addLocalMessage via Sticker; addOffer via Sticker; addQuickReplyShortcutInlineQueryResultMessage via Sticker; addQuickReplyShortcutMessage via Sticker; addQuickReplyShortcutMessageAlbum via Sticker; addRecentSticker via Sticker; addStickerToSet via InputSticker; clickAnimatedEmojiMessage via Sticker; craftGift via Sticker; createBasicGroupChat via Sticker; createGiftCollection via Sticker; createNewSecretChat via Sticker; createNewStickerSet via InputSticker/Sticker; createNewSupergroupChat via Sticker; createPrivateChat via Sticker; createSecretChat via Sticker; createSupergroupChat via Sticker; editBusinessMessageCaption via Sticker; editBusinessMessageChecklist via Sticker; editBusinessMessageLiveLocation via Sticker; editBusinessMessageMedia via Sticker; editBusinessMessageReplyMarkup via Sticker; editBusinessMessageText via Sticker; editMessageCaption via Sticker; editMessageChecklist via Sticker; editMessageLiveLocation via Sticker; editMessageMedia via Sticker; editMessageReplyMarkup via Sticker; editMessageText via Sticker; forwardMessages via Sticker; getAnimatedEmoji via Sticker; getArchivedStickerSets via Sticker; getAttachedStickerSets via Sticker; getAvailableGifts via Sticker; getCallbackQueryMessage via Sticker; plus 101 more schema references
```

### StickerFullType

```text
Type: StickerFullType
Storage: embedded
Storage target: Sticker.full_type
Decision: This is the full sticker type metadata stored inside Sticker.full_type. It has no row identity outside the Sticker owner.
Rejected:
- table: The selected embedded decision stores this shape through Sticker.full_type; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: stickerFullTypeCustomEmoji(custom_emoji_id:int64, needs_repainting:Bool); stickerFullTypeMask(mask_position:maskPosition); stickerFullTypeRegular(premium_animation:file)
- update use: updateActiveGiftAuctions via Sticker; updateActiveLiveLocationMessages via Sticker; updateActiveNotifications via Sticker; updateAnimatedEmojiMessageClicked via Sticker; updateBusinessMessageEdited via Sticker; updateChatLastMessage via Sticker; updateChatReplyMarkup via Sticker; updateChatTheme via Sticker; updateDirectMessagesChatTopic via Sticker; updateFileAddedToDownloads via Sticker; updateGiftAuctionState via Sticker; updateMessageContent via Sticker; updateMessageSendFailed via Sticker; updateMessageSendSucceeded via Sticker; updateNewBusinessCallbackQuery via Sticker; updateNewBusinessMessage via Sticker; updateNewChat via Sticker; updateNewGuestQuery via Sticker; updateNewMessage via Sticker; updateNotification via Sticker; updateNotificationGroup via Sticker; updatePoll via Sticker; updateQuickReplyShortcut via Sticker; updateQuickReplyShortcutMessages via Sticker; plus 5 more schema references
- type use: Sticker.full_type; animatedEmoji via Sticker; availableGift via Sticker; availableGifts via Sticker; businessInfo via Sticker; businessMessage via Sticker; businessMessages via Sticker; businessStartPage via Sticker; chat via Sticker; chatEvent via Sticker; chatEventMessageDeleted via Sticker; chatEventMessageEdited via Sticker; chatEventMessagePinned via Sticker; chatEventMessageUnpinned via Sticker; chatEventPollStopped via Sticker; chatEvents via Sticker; chatThemeGift via Sticker; craftGiftResultSuccess via Sticker; diceStickersRegular via Sticker; diceStickersSlotMachine via Sticker; directMessagesChatTopic via Sticker; emojiCategories via Sticker; emojiCategory via Sticker; emojiReaction via Sticker; fileDownload via Sticker; plus 111 more schema references
- procedures: addGiftCollectionGifts via Sticker; addLocalMessage via Sticker; addOffer via Sticker; addQuickReplyShortcutInlineQueryResultMessage via Sticker; addQuickReplyShortcutMessage via Sticker; addQuickReplyShortcutMessageAlbum via Sticker; addRecentSticker via Sticker; clickAnimatedEmojiMessage via Sticker; craftGift via Sticker; createBasicGroupChat via Sticker; createGiftCollection via Sticker; createNewSecretChat via Sticker; createNewStickerSet via Sticker; createNewSupergroupChat via Sticker; createPrivateChat via Sticker; createSecretChat via Sticker; createSupergroupChat via Sticker; editBusinessMessageCaption via Sticker; editBusinessMessageChecklist via Sticker; editBusinessMessageLiveLocation via Sticker; editBusinessMessageMedia via Sticker; editBusinessMessageReplyMarkup via Sticker; editBusinessMessageText via Sticker; editMessageCaption via Sticker; editMessageChecklist via Sticker; editMessageLiveLocation via Sticker; editMessageMedia via Sticker; editMessageReplyMarkup via Sticker; editMessageText via Sticker; forwardMessages via Sticker; getAnimatedEmoji via Sticker; getArchivedStickerSets via Sticker; getAttachedStickerSets via Sticker; getAvailableGifts via Sticker; getCallbackQueryMessage via Sticker; getChat via Sticker; plus 97 more schema references
```

### StickerSet

```text
Type: StickerSet
Storage: table
Storage target: id
Decision: This is the canonical sticker set row keyed by StickerSet.id. updateStickerSet replaces the set and sticker-set procedures address sets by set_id or name.
Rejected:
- embedded: The selected table decision has a separate storage shape through id; treating it as only an owner field would lose the update or identity shape.
- extend: The selected table decision is not a one-to-one structural extension of a single owner row.
- facet: The selected table decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected table decision is not stored only as a key/value association between two TDLib types.
- kv: The selected table decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected table decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: stickerSet(id:int64, title:string, name:string, thumbnail:thumbnail, thumbnail_outline:outline, is_owned:Bool, is_installed:Bool, is_archived:Bool, is_official:Bool, sticker_type:StickerType, needs_repainting:Bool, is_allowed_as_chat_emoji_status:Bool, is_viewed:Bool, stickers:vector<sticker>, emojis:vector<emojis>)
- update use: updateStickerSet.sticker_set
- type use: none
- procedures: createNewStickerSet -> StickerSet; getStickerSet -> StickerSet; searchStickerSet -> StickerSet
```

### StickerSetInfo

```text
Type: StickerSetInfo
Storage: embedded
Storage target: StickerSets.sets, TrendingStickerSets.sets
Decision: This is a lightweight sticker-set summary item returned in sticker-set lists. The canonical set state is StickerSet; StickerSetInfo is stored only as list summary payload.
Rejected:
- table: The selected embedded decision stores this shape through StickerSets.sets, TrendingStickerSets.sets; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: stickerSetInfo(id:int64, title:string, name:string, thumbnail:thumbnail, thumbnail_outline:outline, is_owned:Bool, is_installed:Bool, is_archived:Bool, is_official:Bool, sticker_type:StickerType, needs_repainting:Bool, is_allowed_as_chat_emoji_status:Bool, is_viewed:Bool, size:int32, covers:vector<sticker>)
- update use: updateTrendingStickerSets via TrendingStickerSets
- type use: StickerSets.sets; TrendingStickerSets.sets
- procedures: getArchivedStickerSets via StickerSets; getAttachedStickerSets via StickerSets; getInstalledStickerSets via StickerSets; getOwnedStickerSets via StickerSets; getTrendingStickerSets via TrendingStickerSets; searchInstalledStickerSets via StickerSets; searchStickerSets via StickerSets
```

### StickerType

```text
Type: StickerType
Storage: embedded
Storage target: StickerSet.sticker_type, StickerSetInfo.sticker_type, installed_sticker_sets.sticker_type, trending_sticker_sets.sticker_type
Decision: This is the sticker category selector for sticker set state and sticker-set list caches. It is an enum-like value and has no standalone row lifecycle.
Rejected:
- table: The selected embedded decision stores this shape through StickerSet.sticker_type, StickerSetInfo.sticker_type, installed_sticker_sets.sticker_type, trending_sticker_sets.sticker_type; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: stickerTypeCustomEmoji(); stickerTypeMask(); stickerTypeRegular()
- update use: updateInstalledStickerSets.sticker_type; updateTrendingStickerSets.sticker_type; updateStickerSet via StickerSet
- type use: StickerSet.sticker_type; StickerSetInfo.sticker_type; stickerSets via StickerSetInfo; trendingStickerSets via StickerSetInfo
- procedures: createNewStickerSet(sticker_type); getAllStickerEmojis(sticker_type); getArchivedStickerSets(sticker_type); getAttachedStickerSets via StickerSetInfo; getInstalledStickerSets(sticker_type); getOwnedStickerSets via StickerSetInfo; getStickerSet via StickerSet; getStickers(sticker_type); getTrendingStickerSets(sticker_type); reorderInstalledStickerSets(sticker_type); searchInstalledStickerSets(sticker_type); searchStickerSet via StickerSet; searchStickerSets(sticker_type); searchStickers(sticker_type)
```

### Story

```text
Type: Story
Storage: table
Storage target: poster_chat_id = Chat.id, id
Decision: This is the canonical story row keyed by poster_chat_id plus story id. updateStory and story procedures address or replace that story identity.
Rejected:
- embedded: The selected table decision has a separate storage shape through poster_chat_id = Chat.id, id; treating it as only an owner field would lose the update or identity shape.
- extend: The selected table decision is not a one-to-one structural extension of a single owner row.
- facet: The selected table decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected table decision is not stored only as a key/value association between two TDLib types.
- kv: The selected table decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected table decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: story(id:int32, poster_chat_id:int53, poster_id:MessageSender, date:int32, is_being_posted:Bool, is_being_edited:Bool, is_edited:Bool, is_posted_to_chat_page:Bool, is_visible_only_for_self:Bool, can_be_added_to_album:Bool, can_be_deleted:Bool, can_be_edited:Bool, can_be_forwarded:Bool, can_be_replied:Bool, can_set_privacy_settings:Bool, can_toggle_is_posted_to_chat_page:Bool, can_get_statistics:Bool, can_get_interactions:Bool, has_expired_viewers:Bool, repost_info:storyRepostInfo, interaction_info:storyInteractionInfo, chosen_reaction_type:ReactionType, privacy_settings:StoryPrivacySettings, content:StoryContent, areas:vector<storyArea>, caption:formattedText, album_ids:vector<int32>)
- update use: updateStory.story; updateStoryPostFailed.story; updateStoryPostSucceeded.story
- type use: FoundStories.stories; PublicForward.story; StartLiveStoryResult.story; Stories.stories; StoryInteractionType.story; publicForwards via PublicForward; storyInteraction via StoryInteractionType; storyInteractions via StoryInteractionType
- procedures: editBusinessStory -> Story; getChatArchivedStories via Stories; getChatPostedToChatPageStories via Stories; getChatStoryInteractions via StoryInteractionType; getMessagePublicForwards via PublicForward; getStory -> Story; getStoryAlbumStories via Stories; getStoryInteractions via StoryInteractionType; getStoryPublicForwards via PublicForward; postStory -> Story; searchPublicStoriesByLocation via FoundStories; searchPublicStoriesByTag via FoundStories; searchPublicStoriesByVenue via FoundStories; startLiveStory via StartLiveStoryResult
```

### StoryArea

```text
Type: StoryArea
Storage: embedded
Storage target: Story.areas
Decision: This is one clickable area in a story. It has no identity outside the owning Story.areas collection.
Rejected:
- table: The selected embedded decision stores this shape through Story.areas; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: storyArea(position:storyAreaPosition, type:StoryAreaType)
- update use: updateStory via Story; updateStoryPostFailed via Story; updateStoryPostSucceeded via Story
- type use: Story.areas; foundStories via Story; publicForwardStory via Story; publicForwards via Story; startLiveStoryResultOk via Story; stories via Story; storyInteraction via Story; storyInteractionTypeRepost via Story; storyInteractions via Story
- procedures: editBusinessStory via Story; getChatArchivedStories via Story; getChatPostedToChatPageStories via Story; getChatStoryInteractions via Story; getMessagePublicForwards via Story; getStory via Story; getStoryAlbumStories via Story; getStoryInteractions via Story; getStoryPublicForwards via Story; postStory via Story; searchPublicStoriesByLocation via Story; searchPublicStoriesByTag via Story; searchPublicStoriesByVenue via Story; startLiveStory via Story
```

### StoryAreaPosition

```text
Type: StoryAreaPosition
Storage: embedded
Storage target: InputStoryArea.position, StoryArea.position
Decision: This is geometry metadata for input and stored story areas. It has no identity outside the owning area value.
Rejected:
- table: The selected embedded decision stores this shape through InputStoryArea.position, StoryArea.position; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: storyAreaPosition(x_percentage:double, y_percentage:double, width_percentage:double, height_percentage:double, rotation_angle:double, corner_radius_percentage:double)
- update use: updateStory via StoryArea; updateStoryPostFailed via StoryArea; updateStoryPostSucceeded via StoryArea
- type use: InputStoryArea.position; StoryArea.position; foundStories via StoryArea; inputStoryAreas via InputStoryArea; publicForwardStory via StoryArea; publicForwards via StoryArea; startLiveStoryResultOk via StoryArea; stories via StoryArea; story via StoryArea; storyInteraction via StoryArea; storyInteractionTypeRepost via StoryArea; storyInteractions via StoryArea
- procedures: editBusinessStory via InputStoryArea/StoryArea; editStory via InputStoryArea; getChatArchivedStories via StoryArea; getChatPostedToChatPageStories via StoryArea; getChatStoryInteractions via StoryArea; getMessagePublicForwards via StoryArea; getStory via StoryArea; getStoryAlbumStories via StoryArea; getStoryInteractions via StoryArea; getStoryPublicForwards via StoryArea; postStory via InputStoryArea/StoryArea; searchPublicStoriesByLocation via StoryArea; searchPublicStoriesByTag via StoryArea; searchPublicStoriesByVenue via StoryArea; startLiveStory via StoryArea
```

### StoryAreaType

```text
Type: StoryAreaType
Storage: embedded
Storage target: StoryArea.type
Decision: This is the area action payload stored inside StoryArea.type. It has no independent lifecycle outside the story area.
Rejected:
- table: The selected embedded decision stores this shape through StoryArea.type; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: storyAreaTypeLink(url:string); storyAreaTypeLocation(location:location, address:locationAddress); storyAreaTypeMessage(chat_id:int53, message_id:int53); storyAreaTypeSuggestedReaction(reaction_type:ReactionType, total_count:int32, is_dark:Bool, is_flipped:Bool); storyAreaTypeUpgradedGift(gift_name:string); storyAreaTypeVenue(venue:venue); storyAreaTypeWeather(temperature:double, emoji:string, background_color:int32)
- update use: updateStory via StoryArea; updateStoryPostFailed via StoryArea; updateStoryPostSucceeded via StoryArea
- type use: StoryArea.type; foundStories via StoryArea; publicForwardStory via StoryArea; publicForwards via StoryArea; startLiveStoryResultOk via StoryArea; stories via StoryArea; story via StoryArea; storyInteraction via StoryArea; storyInteractionTypeRepost via StoryArea; storyInteractions via StoryArea
- procedures: editBusinessStory via StoryArea; getChatArchivedStories via StoryArea; getChatPostedToChatPageStories via StoryArea; getChatStoryInteractions via StoryArea; getMessagePublicForwards via StoryArea; getStory via StoryArea; getStoryAlbumStories via StoryArea; getStoryInteractions via StoryArea; getStoryPublicForwards via StoryArea; postStory via StoryArea; searchPublicStoriesByLocation via StoryArea; searchPublicStoriesByTag via StoryArea; searchPublicStoriesByVenue via StoryArea; startLiveStory via StoryArea
```

### StoryContent

```text
Type: StoryContent
Storage: embedded
Storage target: BotMediaPreview.content, Story.content
Decision: This is the content payload for a story or bot media preview. Nested media files remain File references; StoryContent itself is an owner field value.
Rejected:
- table: The selected embedded decision stores this shape through BotMediaPreview.content, Story.content; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: storyContentLive(group_call_id:int32, is_rtmp_stream:Bool); storyContentPhoto(photo:photo); storyContentUnsupported(); storyContentVideo(video:storyVideo, alternative_video:storyVideo)
- update use: updateStory via Story; updateStoryPostFailed via Story; updateStoryPostSucceeded via Story
- type use: BotMediaPreview.content; Story.content; botMediaPreviewInfo via BotMediaPreview; botMediaPreviews via BotMediaPreview; foundStories via Story; publicForwardStory via Story; publicForwards via Story; startLiveStoryResultOk via Story; stories via Story; storyInteraction via Story; storyInteractionTypeRepost via Story; storyInteractions via Story
- procedures: addBotMediaPreview via BotMediaPreview; editBotMediaPreview via BotMediaPreview; editBusinessStory via Story; getBotMediaPreviewInfo via BotMediaPreview; getBotMediaPreviews via BotMediaPreview; getChatArchivedStories via Story; getChatPostedToChatPageStories via Story; getChatStoryInteractions via Story; getMessagePublicForwards via Story; getStory via Story; getStoryAlbumStories via Story; getStoryInteractions via Story; getStoryPublicForwards via Story; postStory via Story; searchPublicStoriesByLocation via Story; searchPublicStoriesByTag via Story; searchPublicStoriesByVenue via Story; startLiveStory via Story
```

### StoryContentType

```text
Type: StoryContentType
Storage: embedded
Storage target: InternalLinkType.content_type
Decision: This is a story-content selector nested in internal-link routing payload. It is not durable state on its own.
Rejected:
- table: The selected embedded decision stores this shape through InternalLinkType.content_type; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: storyContentTypeLive(); storyContentTypePhoto(); storyContentTypeUnsupported(); storyContentTypeVideo()
- update use: updateActiveLiveLocationMessages via InternalLinkType; updateActiveNotifications via InternalLinkType; updateBusinessMessageEdited via InternalLinkType; updateChatLastMessage via InternalLinkType; updateChatReplyMarkup via InternalLinkType; updateDirectMessagesChatTopic via InternalLinkType; updateFileAddedToDownloads via InternalLinkType; updateMessageEdited via InternalLinkType; updateMessageSendFailed via InternalLinkType; updateMessageSendSucceeded via InternalLinkType; updateNewBusinessCallbackQuery via InternalLinkType; updateNewBusinessMessage via InternalLinkType; updateNewChat via InternalLinkType; updateNewGuestQuery via InternalLinkType; updateNewMessage via InternalLinkType; updateNotification via InternalLinkType; updateNotificationGroup via InternalLinkType; updateQuickReplyShortcut via InternalLinkType; updateQuickReplyShortcutMessages via InternalLinkType; updateSavedMessagesTopic via InternalLinkType; updateUserFullInfo via InternalLinkType
- type use: InternalLinkType.content_type; botInfo via InternalLinkType; businessMessage via InternalLinkType; businessMessages via InternalLinkType; chat via InternalLinkType; chatEvent via InternalLinkType; chatEventMessageDeleted via InternalLinkType; chatEventMessageEdited via InternalLinkType; chatEventMessagePinned via InternalLinkType; chatEventMessageUnpinned via InternalLinkType; chatEventPollStopped via InternalLinkType; chatEvents via InternalLinkType; directMessagesChatTopic via InternalLinkType; fileDownload via InternalLinkType; forumTopic via InternalLinkType; forumTopics via InternalLinkType; foundChatMessages via InternalLinkType; foundFileDownloads via InternalLinkType; foundMessages via InternalLinkType; foundPublicPosts via InternalLinkType; inlineKeyboardButton via InternalLinkType; inlineKeyboardButtonTypeSwitchInline via InternalLinkType; inputInlineQueryResultAnimation via InternalLinkType; inputInlineQueryResultArticle via InternalLinkType; inputInlineQueryResultAudio via InternalLinkType; plus 36 more schema references
- procedures: addLocalMessage via InternalLinkType; addOffer via InternalLinkType; addQuickReplyShortcutInlineQueryResultMessage via InternalLinkType; addQuickReplyShortcutMessage via InternalLinkType; addQuickReplyShortcutMessageAlbum via InternalLinkType; answerGuestQuery via InternalLinkType; answerInlineQuery via InternalLinkType; answerWebAppQuery via InternalLinkType; createBasicGroupChat via InternalLinkType; createNewSecretChat via InternalLinkType; createNewSupergroupChat via InternalLinkType; createPrivateChat via InternalLinkType; createSecretChat via InternalLinkType; createSupergroupChat via InternalLinkType; editBusinessMessageCaption via InternalLinkType; editBusinessMessageChecklist via InternalLinkType; editBusinessMessageLiveLocation via InternalLinkType; editBusinessMessageMedia via InternalLinkType; editBusinessMessageReplyMarkup via InternalLinkType; editBusinessMessageText via InternalLinkType; editInlineMessageCaption via InternalLinkType; editInlineMessageLiveLocation via InternalLinkType; editInlineMessageMedia via InternalLinkType; editInlineMessageReplyMarkup via InternalLinkType; editInlineMessageText via InternalLinkType; editMessageCaption via InternalLinkType; editMessageChecklist via InternalLinkType; editMessageLiveLocation via InternalLinkType; editMessageMedia via InternalLinkType; editMessageReplyMarkup via InternalLinkType; editMessageText via InternalLinkType; forwardMessages via InternalLinkType; getCallbackQueryMessage via InternalLinkType; getChat via InternalLinkType; getChatEventLog via InternalLinkType; getChatHistory via InternalLinkType; plus 57 more schema references
```

### StoryInfo

```text
Type: StoryInfo
Storage: embedded
Storage target: ChatActiveStories.stories
Decision: This is a compact story summary inside ChatActiveStories. The canonical story row is Story; StoryInfo is stored only as active-story summary payload.
Rejected:
- table: The selected embedded decision stores this shape through ChatActiveStories.stories; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: storyInfo(story_id:int32, date:int32, is_for_close_friends:Bool, is_live:Bool)
- update use: updateChatActiveStories via ChatActiveStories
- type use: ChatActiveStories.stories
- procedures: getChatActiveStories via ChatActiveStories
```

### StoryInteractionInfo

```text
Type: StoryInteractionInfo
Storage: embedded
Storage target: Story.interaction_info
Decision: This is aggregate interaction metadata stored on a Story. It has no identity outside Story.interaction_info.
Rejected:
- table: The selected embedded decision stores this shape through Story.interaction_info; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: storyInteractionInfo(view_count:int32, forward_count:int32, reaction_count:int32, recent_viewer_user_ids:vector<int53>)
- update use: updateStory via Story; updateStoryPostFailed via Story; updateStoryPostSucceeded via Story
- type use: Story.interaction_info; foundStories via Story; publicForwardStory via Story; publicForwards via Story; startLiveStoryResultOk via Story; stories via Story; storyInteraction via Story; storyInteractionTypeRepost via Story; storyInteractions via Story
- procedures: editBusinessStory via Story; getChatArchivedStories via Story; getChatPostedToChatPageStories via Story; getChatStoryInteractions via Story; getMessagePublicForwards via Story; getStory via Story; getStoryAlbumStories via Story; getStoryInteractions via Story; getStoryPublicForwards via Story; postStory via Story; searchPublicStoriesByLocation via Story; searchPublicStoriesByTag via Story; searchPublicStoriesByVenue via Story; startLiveStory via Story
```

### StoryList

```text
Type: StoryList
Storage: embedded
Storage target: ChatActiveStories.list, story_list_chat_count
Decision: This is an enum-like story-list selector used by active-story state and story-list counts. It has no row lifecycle outside those owner values.
Rejected:
- table: The selected embedded decision stores this shape through ChatActiveStories.list, story_list_chat_count; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: storyListArchive(); storyListMain()
- update use: updateStoryListChatCount.story_list; updateChatActiveStories via ChatActiveStories
- type use: ChatActiveStories.list
- procedures: getChatActiveStories via ChatActiveStories; loadActiveStories(story_list); setChatActiveStoriesList(story_list)
```

### StoryOrigin

```text
Type: StoryOrigin
Storage: embedded
Storage target: StoryRepostInfo.origin
Decision: This is the origin metadata for a story repost. It has no identity outside StoryRepostInfo.origin.
Rejected:
- table: The selected embedded decision stores this shape through StoryRepostInfo.origin; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: storyOriginHiddenUser(poster_name:string); storyOriginPublicStory(chat_id:int53, story_id:int32)
- update use: updateStory via StoryRepostInfo; updateStoryPostFailed via StoryRepostInfo; updateStoryPostSucceeded via StoryRepostInfo
- type use: StoryRepostInfo.origin; foundStories via StoryRepostInfo; publicForwardStory via StoryRepostInfo; publicForwards via StoryRepostInfo; startLiveStoryResultOk via StoryRepostInfo; stories via StoryRepostInfo; story via StoryRepostInfo; storyInteraction via StoryRepostInfo; storyInteractionTypeRepost via StoryRepostInfo; storyInteractions via StoryRepostInfo
- procedures: editBusinessStory via StoryRepostInfo; getChatArchivedStories via StoryRepostInfo; getChatPostedToChatPageStories via StoryRepostInfo; getChatStoryInteractions via StoryRepostInfo; getMessagePublicForwards via StoryRepostInfo; getStory via StoryRepostInfo; getStoryAlbumStories via StoryRepostInfo; getStoryInteractions via StoryRepostInfo; getStoryPublicForwards via StoryRepostInfo; postStory via StoryRepostInfo; searchPublicStoriesByLocation via StoryRepostInfo; searchPublicStoriesByTag via StoryRepostInfo; searchPublicStoriesByVenue via StoryRepostInfo; startLiveStory via StoryRepostInfo
```

### StoryPrivacySettings

```text
Type: StoryPrivacySettings
Storage: embedded
Storage target: Story.privacy_settings
Decision: This is the privacy value stored on a Story and supplied to story mutation procedures. It has no lifecycle outside the story owner.
Rejected:
- table: The selected embedded decision stores this shape through Story.privacy_settings; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: storyPrivacySettingsCloseFriends(); storyPrivacySettingsContacts(except_user_ids:vector<int53>); storyPrivacySettingsEveryone(except_user_ids:vector<int53>); storyPrivacySettingsSelectedUsers(user_ids:vector<int53>)
- update use: updateStory via Story; updateStoryPostFailed via Story; updateStoryPostSucceeded via Story
- type use: Story.privacy_settings; foundStories via Story; publicForwardStory via Story; publicForwards via Story; startLiveStoryResultOk via Story; stories via Story; storyInteraction via Story; storyInteractionTypeRepost via Story; storyInteractions via Story
- procedures: editBusinessStory(privacy_settings); getChatArchivedStories via Story; getChatPostedToChatPageStories via Story; getChatStoryInteractions via Story; getMessagePublicForwards via Story; getStory via Story; getStoryAlbumStories via Story; getStoryInteractions via Story; getStoryPublicForwards via Story; postStory(privacy_settings); searchPublicStoriesByLocation via Story; searchPublicStoriesByTag via Story; searchPublicStoriesByVenue via Story; setStoryPrivacySettings(privacy_settings); startLiveStory(privacy_settings)
```

### StoryRepostInfo

```text
Type: StoryRepostInfo
Storage: embedded
Storage target: Story.repost_info
Decision: This is repost metadata stored on a Story. It has no identity outside Story.repost_info.
Rejected:
- table: The selected embedded decision stores this shape through Story.repost_info; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: storyRepostInfo(origin:StoryOrigin, is_content_modified:Bool)
- update use: updateStory via Story; updateStoryPostFailed via Story; updateStoryPostSucceeded via Story
- type use: Story.repost_info; foundStories via Story; publicForwardStory via Story; publicForwards via Story; startLiveStoryResultOk via Story; stories via Story; storyInteraction via Story; storyInteractionTypeRepost via Story; storyInteractions via Story
- procedures: editBusinessStory via Story; getChatArchivedStories via Story; getChatPostedToChatPageStories via Story; getChatStoryInteractions via Story; getMessagePublicForwards via Story; getStory via Story; getStoryAlbumStories via Story; getStoryInteractions via Story; getStoryPublicForwards via Story; postStory via Story; searchPublicStoriesByLocation via Story; searchPublicStoriesByTag via Story; searchPublicStoriesByVenue via Story; startLiveStory via Story
```

### StoryVideo

```text
Type: StoryVideo
Storage: embedded
Storage target: StoryContent.video, StoryContent.alternative_video
Decision: This is video media metadata nested in story content. The video File is referenced separately; StoryVideo has no standalone identity.
Rejected:
- table: The selected embedded decision stores this shape through StoryContent.video, StoryContent.alternative_video; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: storyVideo(duration:double, width:int32, height:int32, has_stickers:Bool, is_animation:Bool, minithumbnail:minithumbnail, thumbnail:thumbnail, preload_prefix_size:int32, cover_frame_timestamp:double, video:file)
- update use: updateStory via StoryContent; updateStoryPostFailed via StoryContent; updateStoryPostSucceeded via StoryContent
- type use: StoryContent.alternative_video; StoryContent.video; botMediaPreview via StoryContent; botMediaPreviewInfo via StoryContent; botMediaPreviews via StoryContent; foundStories via StoryContent; publicForwardStory via StoryContent; publicForwards via StoryContent; startLiveStoryResultOk via StoryContent; stories via StoryContent; story via StoryContent; storyInteraction via StoryContent; storyInteractionTypeRepost via StoryContent; storyInteractions via StoryContent
- procedures: addBotMediaPreview via StoryContent; editBotMediaPreview via StoryContent; editBusinessStory via StoryContent; getBotMediaPreviewInfo via StoryContent; getBotMediaPreviews via StoryContent; getChatArchivedStories via StoryContent; getChatPostedToChatPageStories via StoryContent; getChatStoryInteractions via StoryContent; getMessagePublicForwards via StoryContent; getStory via StoryContent; getStoryAlbumStories via StoryContent; getStoryInteractions via StoryContent; getStoryPublicForwards via StoryContent; postStory via StoryContent; searchPublicStoriesByLocation via StoryContent; searchPublicStoriesByTag via StoryContent; searchPublicStoriesByVenue via StoryContent; startLiveStory via StoryContent
```

### SuggestedAction

```text
Type: SuggestedAction
Storage: table
Storage target: action_key
Decision: This is an account-level suggested action item. updateSuggestedActions adds and removes individual actions, and hideSuggestedAction addresses one action value, so storage needs one row per stable action key.
Rejected:
- embedded: The selected table decision has a separate storage shape through action_key; treating it as only an owner field would lose the update or identity shape.
- extend: The selected table decision is not a one-to-one structural extension of a single owner row.
- facet: The selected table decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected table decision is not stored only as a key/value association between two TDLib types.
- kv: The selected table decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected table decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: suggestedActionAddLoginPasskey(); suggestedActionCheckPassword(); suggestedActionCheckPhoneNumber(); suggestedActionConvertToBroadcastGroup(supergroup_id:int53); suggestedActionCustom(name:string, title:formattedText, description:formattedText, url:string); suggestedActionEnableArchiveAndMuteNewChats(); suggestedActionExtendPremium(manage_premium_subscription_url:string); suggestedActionExtendStarSubscriptions(); suggestedActionGiftPremiumForChristmas(); suggestedActionRestorePremium(); suggestedActionSetBirthdate(); suggestedActionSetLoginEmailAddress(can_be_hidden:Bool); suggestedActionSetPassword(authorization_delay:int32); suggestedActionSetProfilePhoto(); suggestedActionSubscribeToAnnualPremium(); suggestedActionUpgradePremium(); suggestedActionViewChecksHint()
- update use: updateSuggestedActions.added_actions; updateSuggestedActions.removed_actions
- type use: none
- procedures: hideSuggestedAction(action)
```

### SuggestedPostInfo

```text
Type: SuggestedPostInfo
Storage: embedded
Storage target: Message.suggested_post_info
Decision: This is suggested-post state stored on a Message. updateMessageSuggestedPostInfo replaces the message field by chat_id and message_id.
Rejected:
- table: The selected embedded decision stores this shape through Message.suggested_post_info; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: suggestedPostInfo(price:SuggestedPostPrice, send_date:int32, state:SuggestedPostState, can_be_approved:Bool, can_be_declined:Bool)
- update use: updateMessageSuggestedPostInfo.suggested_post_info; updateActiveLiveLocationMessages via Message; updateActiveNotifications via Message; updateBusinessMessageEdited via Message; updateChatLastMessage via Message; updateChatReplyMarkup via Message; updateDirectMessagesChatTopic via Message; updateFileAddedToDownloads via Message; updateMessageSendFailed via Message; updateMessageSendSucceeded via Message; updateNewBusinessCallbackQuery via Message; updateNewBusinessMessage via Message; updateNewChat via Message; updateNewGuestQuery via Message; updateNewMessage via Message; updateNotification via Message; updateNotificationGroup via Message; updateSavedMessagesTopic via Message
- type use: Message.suggested_post_info; businessMessage via Message; businessMessages via Message; chat via Message; chatEvent via Message; chatEventMessageDeleted via Message; chatEventMessageEdited via Message; chatEventMessagePinned via Message; chatEventMessageUnpinned via Message; chatEventPollStopped via Message; chatEvents via Message; directMessagesChatTopic via Message; fileDownload via Message; forumTopic via Message; forumTopics via Message; foundChatMessages via Message; foundFileDownloads via Message; foundMessages via Message; foundPublicPosts via Message; messageCalendar via Message; messageCalendarDay via Message; messageLinkInfo via Message; messageThreadInfo via Message; messages via Message; notification via Message; plus 8 more schema references
- procedures: addLocalMessage via Message; addOffer via Message; createBasicGroupChat via Message; createNewSecretChat via Message; createNewSupergroupChat via Message; createPrivateChat via Message; createSecretChat via Message; createSupergroupChat via Message; editBusinessMessageCaption via Message; editBusinessMessageChecklist via Message; editBusinessMessageLiveLocation via Message; editBusinessMessageMedia via Message; editBusinessMessageReplyMarkup via Message; editBusinessMessageText via Message; editMessageCaption via Message; editMessageChecklist via Message; editMessageLiveLocation via Message; editMessageMedia via Message; editMessageReplyMarkup via Message; editMessageText via Message; forwardMessages via Message; getCallbackQueryMessage via Message; getChat via Message; getChatEventLog via Message; getChatHistory via Message; getChatMessageByDate via Message; getChatMessageCalendar via Message; getChatPinnedMessage via Message; getChatScheduledMessages via Message; getChatStoryInteractions via Message; getDirectMessagesChatTopic via Message; getDirectMessagesChatTopicHistory via Message; getDirectMessagesChatTopicMessageByDate via Message; getForumTopic via Message; getForumTopicHistory via Message; getForumTopics via Message; plus 37 more schema references
```

### SuggestedPostPrice

```text
Type: SuggestedPostPrice
Storage: embedded
Storage target: InputSuggestedPostInfo.price, MessageContent.price, SuggestedPostInfo.price
Decision: This is suggested-post price metadata nested in input payloads, message content, and suggested-post info. It has no identity outside those owner fields.
Rejected:
- table: The selected embedded decision stores this shape through InputSuggestedPostInfo.price, MessageContent.price, SuggestedPostInfo.price; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: suggestedPostPriceStar(star_count:int53); suggestedPostPriceTon(toncoin_cent_count:int53)
- update use: updateActiveLiveLocationMessages via MessageContent/SuggestedPostInfo; updateActiveNotifications via MessageContent/SuggestedPostInfo; updateBusinessMessageEdited via MessageContent/SuggestedPostInfo; updateChatDraftMessage via InputSuggestedPostInfo; updateChatLastMessage via MessageContent/SuggestedPostInfo; updateChatReplyMarkup via MessageContent/SuggestedPostInfo; updateDirectMessagesChatTopic via InputSuggestedPostInfo/MessageContent/SuggestedPostInfo; updateFileAddedToDownloads via MessageContent/SuggestedPostInfo; updateForumTopic via InputSuggestedPostInfo; updateMessageContent via MessageContent; updateMessageSendFailed via MessageContent/SuggestedPostInfo; updateMessageSendSucceeded via MessageContent/SuggestedPostInfo; updateMessageSuggestedPostInfo via SuggestedPostInfo; updateNewBusinessCallbackQuery via MessageContent/SuggestedPostInfo; updateNewBusinessMessage via MessageContent/SuggestedPostInfo; updateNewChat via InputSuggestedPostInfo/MessageContent/SuggestedPostInfo; updateNewGuestQuery via MessageContent/SuggestedPostInfo; updateNewMessage via MessageContent/SuggestedPostInfo; updateNotification via MessageContent/SuggestedPostInfo; updateNotificationGroup via MessageContent/SuggestedPostInfo; updatePoll via MessageContent; updateQuickReplyShortcut via MessageContent; updateQuickReplyShortcutMessages via MessageContent; updateSavedMessagesTopic via InputSuggestedPostInfo/MessageContent/SuggestedPostInfo; plus 1 more schema references
- type use: InputSuggestedPostInfo.price; MessageContent.price; SuggestedPostInfo.price; businessMessage via MessageContent/SuggestedPostInfo; businessMessages via MessageContent/SuggestedPostInfo; chat via InputSuggestedPostInfo/MessageContent/SuggestedPostInfo; chatEvent via MessageContent/SuggestedPostInfo; chatEventMessageDeleted via MessageContent/SuggestedPostInfo; chatEventMessageEdited via MessageContent/SuggestedPostInfo; chatEventMessagePinned via MessageContent/SuggestedPostInfo; chatEventMessageUnpinned via MessageContent/SuggestedPostInfo; chatEventPollStopped via MessageContent/SuggestedPostInfo; chatEvents via MessageContent/SuggestedPostInfo; directMessagesChatTopic via InputSuggestedPostInfo/MessageContent/SuggestedPostInfo; draftMessage via InputSuggestedPostInfo; fileDownload via MessageContent/SuggestedPostInfo; forumTopic via InputSuggestedPostInfo/MessageContent/SuggestedPostInfo; forumTopics via InputSuggestedPostInfo/MessageContent/SuggestedPostInfo; foundChatMessages via MessageContent/SuggestedPostInfo; foundFileDownloads via MessageContent/SuggestedPostInfo; foundMessages via MessageContent/SuggestedPostInfo; foundPublicPosts via MessageContent/SuggestedPostInfo; message via MessageContent/SuggestedPostInfo; messageCalendar via MessageContent/SuggestedPostInfo; messageCalendarDay via MessageContent/SuggestedPostInfo; messageLinkInfo via MessageContent/SuggestedPostInfo; messagePoll via MessageContent; plus 21 more schema references
- procedures: addLocalMessage via MessageContent/SuggestedPostInfo; addOffer via InputSuggestedPostInfo/MessageContent/SuggestedPostInfo; addQuickReplyShortcutInlineQueryResultMessage via MessageContent; addQuickReplyShortcutMessage via MessageContent; addQuickReplyShortcutMessageAlbum via MessageContent; createBasicGroupChat via InputSuggestedPostInfo/MessageContent/SuggestedPostInfo; createNewSecretChat via InputSuggestedPostInfo/MessageContent/SuggestedPostInfo; createNewSupergroupChat via InputSuggestedPostInfo/MessageContent/SuggestedPostInfo; createPrivateChat via InputSuggestedPostInfo/MessageContent/SuggestedPostInfo; createSecretChat via InputSuggestedPostInfo/MessageContent/SuggestedPostInfo; createSupergroupChat via InputSuggestedPostInfo/MessageContent/SuggestedPostInfo; editBusinessMessageCaption via MessageContent/SuggestedPostInfo; editBusinessMessageChecklist via MessageContent/SuggestedPostInfo; editBusinessMessageLiveLocation via MessageContent/SuggestedPostInfo; editBusinessMessageMedia via MessageContent/SuggestedPostInfo; editBusinessMessageReplyMarkup via MessageContent/SuggestedPostInfo; editBusinessMessageText via MessageContent/SuggestedPostInfo; editMessageCaption via MessageContent/SuggestedPostInfo; editMessageChecklist via MessageContent/SuggestedPostInfo; editMessageLiveLocation via MessageContent/SuggestedPostInfo; editMessageMedia via MessageContent/SuggestedPostInfo; editMessageReplyMarkup via MessageContent/SuggestedPostInfo; editMessageText via MessageContent/SuggestedPostInfo; forwardMessages via InputSuggestedPostInfo/MessageContent/SuggestedPostInfo; getCallbackQueryMessage via MessageContent/SuggestedPostInfo; getChat via InputSuggestedPostInfo/MessageContent/SuggestedPostInfo; getChatEventLog via MessageContent/SuggestedPostInfo; getChatHistory via MessageContent/SuggestedPostInfo; getChatMessageByDate via MessageContent/SuggestedPostInfo; getChatMessageCalendar via MessageContent/SuggestedPostInfo; getChatPinnedMessage via MessageContent/SuggestedPostInfo; getChatScheduledMessages via MessageContent/SuggestedPostInfo; getChatSponsoredMessages via MessageContent; getChatStoryInteractions via MessageContent/SuggestedPostInfo; getDirectMessagesChatTopic via InputSuggestedPostInfo/MessageContent/SuggestedPostInfo; getDirectMessagesChatTopicHistory via MessageContent/SuggestedPostInfo; plus 43 more schema references
```

### SuggestedPostRefundReason

```text
Type: SuggestedPostRefundReason
Storage: embedded
Storage target: MessageContent.reason
Decision: This is the refund reason payload inside suggested-post refund message content. It has no identity outside the message content.
Rejected:
- table: The selected embedded decision stores this shape through MessageContent.reason; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: suggestedPostRefundReasonPaymentRefunded(); suggestedPostRefundReasonPostDeleted()
- update use: updateActiveLiveLocationMessages via MessageContent; updateActiveNotifications via MessageContent; updateBusinessMessageEdited via MessageContent; updateChatLastMessage via MessageContent; updateChatReplyMarkup via MessageContent; updateDirectMessagesChatTopic via MessageContent; updateFileAddedToDownloads via MessageContent; updateMessageContent via MessageContent; updateMessageSendFailed via MessageContent; updateMessageSendSucceeded via MessageContent; updateNewBusinessCallbackQuery via MessageContent; updateNewBusinessMessage via MessageContent; updateNewChat via MessageContent; updateNewGuestQuery via MessageContent; updateNewMessage via MessageContent; updateNotification via MessageContent; updateNotificationGroup via MessageContent; updatePoll via MessageContent; updateQuickReplyShortcut via MessageContent; updateQuickReplyShortcutMessages via MessageContent; updateSavedMessagesTopic via MessageContent; updateServiceNotification via MessageContent
- type use: MessageContent.reason; businessMessage via MessageContent; businessMessages via MessageContent; chat via MessageContent; chatEvent via MessageContent; chatEventMessageDeleted via MessageContent; chatEventMessageEdited via MessageContent; chatEventMessagePinned via MessageContent; chatEventMessageUnpinned via MessageContent; chatEventPollStopped via MessageContent; chatEvents via MessageContent; directMessagesChatTopic via MessageContent; fileDownload via MessageContent; forumTopic via MessageContent; forumTopics via MessageContent; foundChatMessages via MessageContent; foundFileDownloads via MessageContent; foundMessages via MessageContent; foundPublicPosts via MessageContent; message via MessageContent; messageCalendar via MessageContent; messageCalendarDay via MessageContent; messageLinkInfo via MessageContent; messagePoll via MessageContent; messageReplyToMessage via MessageContent; plus 19 more schema references
- procedures: addLocalMessage via MessageContent; addOffer via MessageContent; addQuickReplyShortcutInlineQueryResultMessage via MessageContent; addQuickReplyShortcutMessage via MessageContent; addQuickReplyShortcutMessageAlbum via MessageContent; createBasicGroupChat via MessageContent; createNewSecretChat via MessageContent; createNewSupergroupChat via MessageContent; createPrivateChat via MessageContent; createSecretChat via MessageContent; createSupergroupChat via MessageContent; editBusinessMessageCaption via MessageContent; editBusinessMessageChecklist via MessageContent; editBusinessMessageLiveLocation via MessageContent; editBusinessMessageMedia via MessageContent; editBusinessMessageReplyMarkup via MessageContent; editBusinessMessageText via MessageContent; editMessageCaption via MessageContent; editMessageChecklist via MessageContent; editMessageLiveLocation via MessageContent; editMessageMedia via MessageContent; editMessageReplyMarkup via MessageContent; editMessageText via MessageContent; forwardMessages via MessageContent; getCallbackQueryMessage via MessageContent; getChat via MessageContent; getChatEventLog via MessageContent; getChatHistory via MessageContent; getChatMessageByDate via MessageContent; getChatMessageCalendar via MessageContent; getChatPinnedMessage via MessageContent; getChatScheduledMessages via MessageContent; getChatSponsoredMessages via MessageContent; getChatStoryInteractions via MessageContent; getDirectMessagesChatTopic via MessageContent; getDirectMessagesChatTopicHistory via MessageContent; plus 42 more schema references
```

### SuggestedPostState

```text
Type: SuggestedPostState
Storage: embedded
Storage target: SuggestedPostInfo.state
Decision: This is the state value for SuggestedPostInfo. It has no lifecycle outside SuggestedPostInfo.state.
Rejected:
- table: The selected embedded decision stores this shape through SuggestedPostInfo.state; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: suggestedPostStateApproved(); suggestedPostStateDeclined(); suggestedPostStatePending()
- update use: updateActiveLiveLocationMessages via SuggestedPostInfo; updateActiveNotifications via SuggestedPostInfo; updateBusinessMessageEdited via SuggestedPostInfo; updateChatLastMessage via SuggestedPostInfo; updateChatReplyMarkup via SuggestedPostInfo; updateDirectMessagesChatTopic via SuggestedPostInfo; updateFileAddedToDownloads via SuggestedPostInfo; updateMessageSendFailed via SuggestedPostInfo; updateMessageSendSucceeded via SuggestedPostInfo; updateMessageSuggestedPostInfo via SuggestedPostInfo; updateNewBusinessCallbackQuery via SuggestedPostInfo; updateNewBusinessMessage via SuggestedPostInfo; updateNewChat via SuggestedPostInfo; updateNewGuestQuery via SuggestedPostInfo; updateNewMessage via SuggestedPostInfo; updateNotification via SuggestedPostInfo; updateNotificationGroup via SuggestedPostInfo; updateSavedMessagesTopic via SuggestedPostInfo
- type use: SuggestedPostInfo.state; businessMessage via SuggestedPostInfo; businessMessages via SuggestedPostInfo; chat via SuggestedPostInfo; chatEvent via SuggestedPostInfo; chatEventMessageDeleted via SuggestedPostInfo; chatEventMessageEdited via SuggestedPostInfo; chatEventMessagePinned via SuggestedPostInfo; chatEventMessageUnpinned via SuggestedPostInfo; chatEventPollStopped via SuggestedPostInfo; chatEvents via SuggestedPostInfo; directMessagesChatTopic via SuggestedPostInfo; fileDownload via SuggestedPostInfo; forumTopic via SuggestedPostInfo; forumTopics via SuggestedPostInfo; foundChatMessages via SuggestedPostInfo; foundFileDownloads via SuggestedPostInfo; foundMessages via SuggestedPostInfo; foundPublicPosts via SuggestedPostInfo; message via SuggestedPostInfo; messageCalendar via SuggestedPostInfo; messageCalendarDay via SuggestedPostInfo; messageLinkInfo via SuggestedPostInfo; messageThreadInfo via SuggestedPostInfo; messages via SuggestedPostInfo; plus 9 more schema references
- procedures: addLocalMessage via SuggestedPostInfo; addOffer via SuggestedPostInfo; createBasicGroupChat via SuggestedPostInfo; createNewSecretChat via SuggestedPostInfo; createNewSupergroupChat via SuggestedPostInfo; createPrivateChat via SuggestedPostInfo; createSecretChat via SuggestedPostInfo; createSupergroupChat via SuggestedPostInfo; editBusinessMessageCaption via SuggestedPostInfo; editBusinessMessageChecklist via SuggestedPostInfo; editBusinessMessageLiveLocation via SuggestedPostInfo; editBusinessMessageMedia via SuggestedPostInfo; editBusinessMessageReplyMarkup via SuggestedPostInfo; editBusinessMessageText via SuggestedPostInfo; editMessageCaption via SuggestedPostInfo; editMessageChecklist via SuggestedPostInfo; editMessageLiveLocation via SuggestedPostInfo; editMessageMedia via SuggestedPostInfo; editMessageReplyMarkup via SuggestedPostInfo; editMessageText via SuggestedPostInfo; forwardMessages via SuggestedPostInfo; getCallbackQueryMessage via SuggestedPostInfo; getChat via SuggestedPostInfo; getChatEventLog via SuggestedPostInfo; getChatHistory via SuggestedPostInfo; getChatMessageByDate via SuggestedPostInfo; getChatMessageCalendar via SuggestedPostInfo; getChatPinnedMessage via SuggestedPostInfo; getChatScheduledMessages via SuggestedPostInfo; getChatStoryInteractions via SuggestedPostInfo; getDirectMessagesChatTopic via SuggestedPostInfo; getDirectMessagesChatTopicHistory via SuggestedPostInfo; getDirectMessagesChatTopicMessageByDate via SuggestedPostInfo; getForumTopic via SuggestedPostInfo; getForumTopicHistory via SuggestedPostInfo; getForumTopics via SuggestedPostInfo; plus 37 more schema references
```

### Supergroup

```text
Type: Supergroup
Storage: table
Storage target: id
Decision: This is the canonical supergroup or channel row keyed by Supergroup.id. updateSupergroup replaces that row and supergroup procedures address it by supergroup_id.
Rejected:
- embedded: The selected table decision has a separate storage shape through id; treating it as only an owner field would lose the update or identity shape.
- extend: The selected table decision is not a one-to-one structural extension of a single owner row.
- facet: The selected table decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected table decision is not stored only as a key/value association between two TDLib types.
- kv: The selected table decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected table decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: supergroup(id:int53, usernames:usernames, date:int32, status:ChatMemberStatus, member_count:int32, boost_level:int32, has_automatic_translation:Bool, has_linked_chat:Bool, has_location:Bool, sign_messages:Bool, show_message_sender:Bool, join_to_send_messages:Bool, join_by_request:Bool, is_slow_mode_enabled:Bool, is_channel:Bool, is_broadcast_group:Bool, is_forum:Bool, is_direct_messages_group:Bool, is_administered_direct_messages_group:Bool, verification_status:verificationStatus, has_direct_messages_group:Bool, has_forum_tabs:Bool, restriction_info:restrictionInfo, paid_message_star_count:int53, active_story_state:ActiveStoryState)
- update use: updateSupergroup.supergroup
- type use: none
- procedures: getSupergroup -> Supergroup
```

### SupergroupFullInfo

```text
Type: SupergroupFullInfo
Storage: extend
Storage target: Supergroup
Decision: This is full information for one Supergroup identified externally by supergroup_id. It structurally extends the Supergroup row rather than forming a separate entity.
Rejected:
- table: The selected extend decision stores this shape through Supergroup; it does not require its own independently addressed table row.
- embedded: The selected extend decision has a separate storage shape through Supergroup; treating it as only an owner field would lose the update or identity shape.
- facet: The selected extend decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected extend decision is not stored only as a key/value association between two TDLib types.
- kv: The selected extend decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected extend decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: supergroupFullInfo(photo:chatPhoto, description:string, member_count:int32, administrator_count:int32, restricted_count:int32, banned_count:int32, linked_chat_id:int53, direct_messages_chat_id:int53, slow_mode_delay:int32, slow_mode_delay_expires_in:double, can_enable_paid_messages:Bool, can_enable_paid_reaction:Bool, can_get_members:Bool, has_hidden_members:Bool, can_hide_members:Bool, can_set_sticker_set:Bool, can_set_location:Bool, can_get_statistics:Bool, can_get_revenue_statistics:Bool, can_get_star_revenue_statistics:Bool, can_send_gift:Bool, can_toggle_aggressive_anti_spam:Bool, is_all_history_available:Bool, can_have_sponsored_messages:Bool, has_aggressive_anti_spam_enabled:Bool, has_paid_media_allowed:Bool, has_pinned_stories:Bool, gift_count:int32, my_boost_count:int32, unrestrict_boost_count:int32, outgoing_paid_message_star_count:int53, sticker_set_id:int64, custom_emoji_sticker_set_id:int64, location:chatLocation, invite_link:chatInviteLink, bot_commands:vector<botCommands>, bot_verification:botVerification, main_profile_tab:ProfileTab, upgraded_from_basic_group_id:int53, upgraded_from_max_message_id:int53)
- update use: updateSupergroupFullInfo.supergroup_full_info
- type use: none
- procedures: getSupergroupFullInfo -> SupergroupFullInfo
```

### TargetChat

```text
Type: TargetChat
Storage: embedded
Storage target: InlineKeyboardButtonType.target_chat, InternalLinkType.target_chat
Decision: This is a target-chat selector nested in inline button and internal-link payloads. It has no identity outside those owner fields.
Rejected:
- table: The selected embedded decision stores this shape through InlineKeyboardButtonType.target_chat, InternalLinkType.target_chat; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: targetChatChosen(types:targetChatTypes); targetChatCurrent(); targetChatInternalLink(link:InternalLinkType)
- update use: updateActiveLiveLocationMessages via InlineKeyboardButtonType/InternalLinkType; updateActiveNotifications via InlineKeyboardButtonType/InternalLinkType; updateBusinessMessageEdited via InlineKeyboardButtonType/InternalLinkType; updateChatLastMessage via InlineKeyboardButtonType/InternalLinkType; updateChatReplyMarkup via InlineKeyboardButtonType/InternalLinkType; updateDirectMessagesChatTopic via InlineKeyboardButtonType/InternalLinkType; updateFileAddedToDownloads via InlineKeyboardButtonType/InternalLinkType; updateMessageEdited via InlineKeyboardButtonType/InternalLinkType; updateMessageSendFailed via InlineKeyboardButtonType/InternalLinkType; updateMessageSendSucceeded via InlineKeyboardButtonType/InternalLinkType; updateNewBusinessCallbackQuery via InlineKeyboardButtonType/InternalLinkType; updateNewBusinessMessage via InlineKeyboardButtonType/InternalLinkType; updateNewChat via InlineKeyboardButtonType/InternalLinkType; updateNewGuestQuery via InlineKeyboardButtonType/InternalLinkType; updateNewMessage via InlineKeyboardButtonType/InternalLinkType; updateNotification via InlineKeyboardButtonType/InternalLinkType; updateNotificationGroup via InlineKeyboardButtonType/InternalLinkType; updateQuickReplyShortcut via InlineKeyboardButtonType/InternalLinkType; updateQuickReplyShortcutMessages via InlineKeyboardButtonType/InternalLinkType; updateSavedMessagesTopic via InlineKeyboardButtonType/InternalLinkType; updateUserFullInfo via InternalLinkType
- type use: InlineKeyboardButtonType.target_chat; InternalLinkType.target_chat; botInfo via InternalLinkType; businessMessage via InlineKeyboardButtonType/InternalLinkType; businessMessages via InlineKeyboardButtonType/InternalLinkType; chat via InlineKeyboardButtonType/InternalLinkType; chatEvent via InlineKeyboardButtonType/InternalLinkType; chatEventMessageDeleted via InlineKeyboardButtonType/InternalLinkType; chatEventMessageEdited via InlineKeyboardButtonType/InternalLinkType; chatEventMessagePinned via InlineKeyboardButtonType/InternalLinkType; chatEventMessageUnpinned via InlineKeyboardButtonType/InternalLinkType; chatEventPollStopped via InlineKeyboardButtonType/InternalLinkType; chatEvents via InlineKeyboardButtonType/InternalLinkType; directMessagesChatTopic via InlineKeyboardButtonType/InternalLinkType; fileDownload via InlineKeyboardButtonType/InternalLinkType; forumTopic via InlineKeyboardButtonType/InternalLinkType; forumTopics via InlineKeyboardButtonType/InternalLinkType; foundChatMessages via InlineKeyboardButtonType/InternalLinkType; foundFileDownloads via InlineKeyboardButtonType/InternalLinkType; foundMessages via InlineKeyboardButtonType/InternalLinkType; foundPublicPosts via InlineKeyboardButtonType/InternalLinkType; inlineKeyboardButton via InlineKeyboardButtonType/InternalLinkType; inputInlineQueryResultAnimation via InlineKeyboardButtonType/InternalLinkType; inputInlineQueryResultArticle via InlineKeyboardButtonType/InternalLinkType; inputInlineQueryResultAudio via InlineKeyboardButtonType/InternalLinkType; inputInlineQueryResultContact via InlineKeyboardButtonType/InternalLinkType; plus 34 more schema references
- procedures: addLocalMessage via InlineKeyboardButtonType/InternalLinkType; addOffer via InlineKeyboardButtonType/InternalLinkType; addQuickReplyShortcutInlineQueryResultMessage via InlineKeyboardButtonType/InternalLinkType; addQuickReplyShortcutMessage via InlineKeyboardButtonType/InternalLinkType; addQuickReplyShortcutMessageAlbum via InlineKeyboardButtonType/InternalLinkType; answerGuestQuery via InlineKeyboardButtonType/InternalLinkType; answerInlineQuery via InlineKeyboardButtonType/InternalLinkType; answerWebAppQuery via InlineKeyboardButtonType/InternalLinkType; createBasicGroupChat via InlineKeyboardButtonType/InternalLinkType; createNewSecretChat via InlineKeyboardButtonType/InternalLinkType; createNewSupergroupChat via InlineKeyboardButtonType/InternalLinkType; createPrivateChat via InlineKeyboardButtonType/InternalLinkType; createSecretChat via InlineKeyboardButtonType/InternalLinkType; createSupergroupChat via InlineKeyboardButtonType/InternalLinkType; editBusinessMessageCaption via InlineKeyboardButtonType/InternalLinkType; editBusinessMessageChecklist via InlineKeyboardButtonType/InternalLinkType; editBusinessMessageLiveLocation via InlineKeyboardButtonType/InternalLinkType; editBusinessMessageMedia via InlineKeyboardButtonType/InternalLinkType; editBusinessMessageReplyMarkup via InlineKeyboardButtonType/InternalLinkType; editBusinessMessageText via InlineKeyboardButtonType/InternalLinkType; editInlineMessageCaption via InlineKeyboardButtonType/InternalLinkType; editInlineMessageLiveLocation via InlineKeyboardButtonType/InternalLinkType; editInlineMessageMedia via InlineKeyboardButtonType/InternalLinkType; editInlineMessageReplyMarkup via InlineKeyboardButtonType/InternalLinkType; editInlineMessageText via InlineKeyboardButtonType/InternalLinkType; editMessageCaption via InlineKeyboardButtonType/InternalLinkType; editMessageChecklist via InlineKeyboardButtonType/InternalLinkType; editMessageLiveLocation via InlineKeyboardButtonType/InternalLinkType; editMessageMedia via InlineKeyboardButtonType/InternalLinkType; editMessageReplyMarkup via InlineKeyboardButtonType/InternalLinkType; editMessageText via InlineKeyboardButtonType/InternalLinkType; forwardMessages via InlineKeyboardButtonType/InternalLinkType; getCallbackQueryMessage via InlineKeyboardButtonType/InternalLinkType; getChat via InlineKeyboardButtonType/InternalLinkType; getChatEventLog via InlineKeyboardButtonType/InternalLinkType; getChatHistory via InlineKeyboardButtonType/InternalLinkType; plus 57 more schema references
```

### TargetChatTypes

```text
Type: TargetChatTypes
Storage: embedded
Storage target: PreparedInlineMessage.chat_types, TargetChat.types
Decision: This is the allowed-chat mask for prepared inline messages and target-chat selectors. It has no standalone lifecycle.
Rejected:
- table: The selected embedded decision stores this shape through PreparedInlineMessage.chat_types, TargetChat.types; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: targetChatTypes(allow_user_chats:Bool, allow_bot_chats:Bool, allow_group_chats:Bool, allow_channel_chats:Bool)
- update use: updateActiveLiveLocationMessages via TargetChat; updateActiveNotifications via TargetChat; updateBusinessMessageEdited via TargetChat; updateChatLastMessage via TargetChat; updateChatReplyMarkup via TargetChat; updateDirectMessagesChatTopic via TargetChat; updateFileAddedToDownloads via TargetChat; updateMessageEdited via TargetChat; updateMessageSendFailed via TargetChat; updateMessageSendSucceeded via TargetChat; updateNewBusinessCallbackQuery via TargetChat; updateNewBusinessMessage via TargetChat; updateNewChat via TargetChat; updateNewGuestQuery via TargetChat; updateNewMessage via TargetChat; updateNotification via TargetChat; updateNotificationGroup via TargetChat; updateQuickReplyShortcut via TargetChat; updateQuickReplyShortcutMessages via TargetChat; updateSavedMessagesTopic via TargetChat; updateUserFullInfo via TargetChat
- type use: PreparedInlineMessage.chat_types; TargetChat.types; botInfo via TargetChat; businessMessage via TargetChat; businessMessages via TargetChat; chat via TargetChat; chatEvent via TargetChat; chatEventMessageDeleted via TargetChat; chatEventMessageEdited via TargetChat; chatEventMessagePinned via TargetChat; chatEventMessageUnpinned via TargetChat; chatEventPollStopped via TargetChat; chatEvents via TargetChat; directMessagesChatTopic via TargetChat; fileDownload via TargetChat; forumTopic via TargetChat; forumTopics via TargetChat; foundChatMessages via TargetChat; foundFileDownloads via TargetChat; foundMessages via TargetChat; foundPublicPosts via TargetChat; inlineKeyboardButton via TargetChat; inlineKeyboardButtonTypeSwitchInline via TargetChat; inputInlineQueryResultAnimation via TargetChat; inputInlineQueryResultArticle via TargetChat; inputInlineQueryResultAudio via TargetChat; plus 36 more schema references
- procedures: addLocalMessage via TargetChat; addOffer via TargetChat; addQuickReplyShortcutInlineQueryResultMessage via TargetChat; addQuickReplyShortcutMessage via TargetChat; addQuickReplyShortcutMessageAlbum via TargetChat; answerGuestQuery via TargetChat; answerInlineQuery via TargetChat; answerWebAppQuery via TargetChat; createBasicGroupChat via TargetChat; createNewSecretChat via TargetChat; createNewSupergroupChat via TargetChat; createPrivateChat via TargetChat; createSecretChat via TargetChat; createSupergroupChat via TargetChat; editBusinessMessageCaption via TargetChat; editBusinessMessageChecklist via TargetChat; editBusinessMessageLiveLocation via TargetChat; editBusinessMessageMedia via TargetChat; editBusinessMessageReplyMarkup via TargetChat; editBusinessMessageText via TargetChat; editInlineMessageCaption via TargetChat; editInlineMessageLiveLocation via TargetChat; editInlineMessageMedia via TargetChat; editInlineMessageReplyMarkup via TargetChat; editInlineMessageText via TargetChat; editMessageCaption via TargetChat; editMessageChecklist via TargetChat; editMessageLiveLocation via TargetChat; editMessageMedia via TargetChat; editMessageReplyMarkup via TargetChat; editMessageText via TargetChat; forwardMessages via TargetChat; getCallbackQueryMessage via TargetChat; getChat via TargetChat; getChatEventLog via TargetChat; getChatHistory via TargetChat; plus 58 more schema references
```

### TermsOfService

```text
Type: TermsOfService
Storage: table
Storage target: terms_of_service_id
Decision: This is pending terms-of-service text addressed by the terms_of_service_id supplied by updateTermsOfService and accepted by acceptTermsOfService.
Rejected:
- embedded: The selected table decision has a separate storage shape through terms_of_service_id; treating it as only an owner field would lose the update or identity shape.
- extend: The selected table decision is not a one-to-one structural extension of a single owner row.
- facet: The selected table decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected table decision is not stored only as a key/value association between two TDLib types.
- kv: The selected table decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected table decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: termsOfService(text:formattedText, min_user_age:int32, show_popup:Bool)
- update use: updateTermsOfService.terms_of_service; updateAuthorizationState via AuthorizationState
- type use: AuthorizationState.terms_of_service
- procedures: getAuthorizationState via AuthorizationState
```

### TextCompositionStyle

```text
Type: TextCompositionStyle
Storage: table
Storage target: name
Decision: This is a text composition style row keyed by its stable name. updateTextCompositionStyles replaces the catalog list and create, edit, search, and delete procedures address styles by name.
Rejected:
- embedded: The selected table decision has a separate storage shape through name; treating it as only an owner field would lose the update or identity shape.
- extend: The selected table decision is not a one-to-one structural extension of a single owner row.
- facet: The selected table decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected table decision is not stored only as a key/value association between two TDLib types.
- kv: The selected table decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected table decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: textCompositionStyle(name:string, custom_emoji_id:int64, title:string, is_custom:Bool, is_creator:Bool, install_count:int32, prompt:string, creator_user_id:int53, english_example:textCompositionStyleExample)
- update use: updateTextCompositionStyles.styles
- type use: none
- procedures: createTextCompositionStyle -> TextCompositionStyle; editTextCompositionStyle -> TextCompositionStyle; searchTextCompositionStyle -> TextCompositionStyle
```

### TextCompositionStyleExample

```text
Type: TextCompositionStyleExample
Storage: embedded
Storage target: TextCompositionStyle.english_example
Decision: This is example text attached to a composition style or returned fresh by getTextCompositionStyleExample. It has no durable identity outside the style/example payload.
Rejected:
- table: The selected embedded decision stores this shape through TextCompositionStyle.english_example; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: textCompositionStyleExample(source_text:formattedText, result_text:formattedText)
- update use: updateTextCompositionStyles via TextCompositionStyle
- type use: TextCompositionStyle.english_example
- procedures: createTextCompositionStyle via TextCompositionStyle; editTextCompositionStyle via TextCompositionStyle; getTextCompositionStyleExample -> TextCompositionStyleExample; searchTextCompositionStyle via TextCompositionStyle
```

### TextEntity

```text
Type: TextEntity
Storage: embedded
Storage target: FormattedText.entities, TextEntities.entities
Decision: This is one formatting entity inside formatted text. Offset and length are local to the owner text and do not define an independent row.
Rejected:
- table: The selected embedded decision stores this shape through FormattedText.entities, TextEntities.entities; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: textEntity(offset:int32, length:int32, type:TextEntityType)
- update use: updateActiveLiveLocationMessages via FormattedText; updateActiveNotifications via FormattedText; updateAuthorizationState via FormattedText; updateBusinessMessageEdited via FormattedText; updateChatDraftMessage via FormattedText; updateChatFolders via FormattedText; updateChatLastMessage via FormattedText; updateChatReplyMarkup via FormattedText; updateChatTheme via FormattedText; updateDirectMessagesChatTopic via FormattedText; updateFileAddedToDownloads via FormattedText; updateForumTopic via FormattedText; updateMessageContent via FormattedText; updateMessageEdited via FormattedText; updateMessageFactCheck via FormattedText; updateMessageSendFailed via FormattedText; updateMessageSendSucceeded via FormattedText; updateNewBusinessCallbackQuery via FormattedText; updateNewBusinessMessage via FormattedText; updateNewChat via FormattedText; updateNewGroupCallMessage via FormattedText; updateNewGuestQuery via FormattedText; updateNewMessage via FormattedText; updateNotification via FormattedText; plus 15 more schema references
- type use: FormattedText.entities; TextEntities.entities; authorizationStateWaitRegistration via FormattedText; botInfo via FormattedText; botVerification via FormattedText; botVerificationParameters via FormattedText; businessChatLink via FormattedText; businessChatLinkInfo via FormattedText; businessChatLinks via FormattedText; businessMessage via FormattedText; businessMessages via FormattedText; canSendGiftResultFail via FormattedText; chat via FormattedText; chatEvent via FormattedText; chatEventMessageDeleted via FormattedText; chatEventMessageEdited via FormattedText; chatEventMessagePinned via FormattedText; chatEventMessageUnpinned via FormattedText; chatEventPollStopped via FormattedText; chatEvents via FormattedText; chatFolder via FormattedText; chatFolderInfo via FormattedText; chatFolderInviteLinkInfo via FormattedText; chatFolderName via FormattedText; chatThemeGift via FormattedText; checklist via FormattedText; plus 166 more schema references
- procedures: addChecklistTasks via FormattedText; addContact via FormattedText; addLocalMessage via FormattedText; addOffer via FormattedText; addPollOption via FormattedText; addQuickReplyShortcutInlineQueryResultMessage via FormattedText; addQuickReplyShortcutMessage via FormattedText; addQuickReplyShortcutMessageAlbum via FormattedText; answerGuestQuery via FormattedText; answerInlineQuery via FormattedText; answerWebAppQuery via FormattedText; assignStoreTransaction via FormattedText; canPurchaseFromStore via FormattedText; canSendGift via FormattedText; changeImportedContacts via FormattedText; checkChatFolderInviteLink via FormattedText; composeTextWithAi via FormattedText; craftGift via FormattedText; createBasicGroupChat via FormattedText; createBusinessChatLink via FormattedText; createChatFolder via FormattedText; createInvoiceLink via FormattedText; createNewSecretChat via FormattedText; createNewSupergroupChat via FormattedText; createPrivateChat via FormattedText; createSecretChat via FormattedText; createSupergroupChat via FormattedText; createTextCompositionStyle via FormattedText; editBusinessChatLink via FormattedText; editBusinessMessageCaption via FormattedText; editBusinessMessageChecklist via FormattedText; editBusinessMessageLiveLocation via FormattedText; editBusinessMessageMedia via FormattedText; editBusinessMessageReplyMarkup via FormattedText; editBusinessMessageText via FormattedText; editBusinessStory via FormattedText; plus 137 more schema references
```

### TextEntityType

```text
Type: TextEntityType
Storage: embedded
Storage target: TextEntity.type
Decision: This is the formatting-kind value stored inside a TextEntity. It has no identity outside TextEntity.type.
Rejected:
- table: The selected embedded decision stores this shape through TextEntity.type; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: textEntityTypeBankCardNumber(); textEntityTypeBlockQuote(); textEntityTypeBold(); textEntityTypeBotCommand(); textEntityTypeCashtag(); textEntityTypeCode(); textEntityTypeCustomEmoji(custom_emoji_id:int64); textEntityTypeDateTime(unix_time:int32, formatting_type:DateTimeFormattingType); textEntityTypeEmailAddress(); textEntityTypeExpandableBlockQuote(); textEntityTypeHashtag(); textEntityTypeItalic(); textEntityTypeMediaTimestamp(media_timestamp:int32); textEntityTypeMention(); textEntityTypeMentionName(user_id:int53); textEntityTypePhoneNumber(); textEntityTypePre(); textEntityTypePreCode(language:string); textEntityTypeSpoiler(); textEntityTypeStrikethrough(); textEntityTypeTextUrl(url:string); textEntityTypeUnderline(); textEntityTypeUrl()
- update use: updateActiveLiveLocationMessages via TextEntity; updateActiveNotifications via TextEntity; updateAuthorizationState via TextEntity; updateBusinessMessageEdited via TextEntity; updateChatDraftMessage via TextEntity; updateChatFolders via TextEntity; updateChatLastMessage via TextEntity; updateChatReplyMarkup via TextEntity; updateChatTheme via TextEntity; updateDirectMessagesChatTopic via TextEntity; updateFileAddedToDownloads via TextEntity; updateForumTopic via TextEntity; updateMessageContent via TextEntity; updateMessageEdited via TextEntity; updateMessageFactCheck via TextEntity; updateMessageSendFailed via TextEntity; updateMessageSendSucceeded via TextEntity; updateNewBusinessCallbackQuery via TextEntity; updateNewBusinessMessage via TextEntity; updateNewChat via TextEntity; updateNewGroupCallMessage via TextEntity; updateNewGuestQuery via TextEntity; updateNewMessage via TextEntity; updateNotification via TextEntity; plus 15 more schema references
- type use: TextEntity.type; authorizationStateWaitRegistration via TextEntity; botInfo via TextEntity; botVerification via TextEntity; botVerificationParameters via TextEntity; businessChatLink via TextEntity; businessChatLinkInfo via TextEntity; businessChatLinks via TextEntity; businessMessage via TextEntity; businessMessages via TextEntity; canSendGiftResultFail via TextEntity; chat via TextEntity; chatEvent via TextEntity; chatEventMessageDeleted via TextEntity; chatEventMessageEdited via TextEntity; chatEventMessagePinned via TextEntity; chatEventMessageUnpinned via TextEntity; chatEventPollStopped via TextEntity; chatEvents via TextEntity; chatFolder via TextEntity; chatFolderInfo via TextEntity; chatFolderInviteLinkInfo via TextEntity; chatFolderName via TextEntity; chatThemeGift via TextEntity; checklist via TextEntity; plus 168 more schema references
- procedures: addChecklistTasks via TextEntity; addContact via TextEntity; addLocalMessage via TextEntity; addOffer via TextEntity; addPollOption via TextEntity; addQuickReplyShortcutInlineQueryResultMessage via TextEntity; addQuickReplyShortcutMessage via TextEntity; addQuickReplyShortcutMessageAlbum via TextEntity; answerGuestQuery via TextEntity; answerInlineQuery via TextEntity; answerWebAppQuery via TextEntity; assignStoreTransaction via TextEntity; canPurchaseFromStore via TextEntity; canSendGift via TextEntity; changeImportedContacts via TextEntity; checkChatFolderInviteLink via TextEntity; composeTextWithAi via TextEntity; craftGift via TextEntity; createBasicGroupChat via TextEntity; createBusinessChatLink via TextEntity; createChatFolder via TextEntity; createInvoiceLink via TextEntity; createNewSecretChat via TextEntity; createNewSupergroupChat via TextEntity; createPrivateChat via TextEntity; createSecretChat via TextEntity; createSupergroupChat via TextEntity; createTextCompositionStyle via TextEntity; editBusinessChatLink via TextEntity; editBusinessMessageCaption via TextEntity; editBusinessMessageChecklist via TextEntity; editBusinessMessageLiveLocation via TextEntity; editBusinessMessageMedia via TextEntity; editBusinessMessageReplyMarkup via TextEntity; editBusinessMessageText via TextEntity; editBusinessStory via TextEntity; plus 137 more schema references
```

### TextQuote

```text
Type: TextQuote
Storage: embedded
Storage target: MessageReplyTo.quote
Decision: This is quote metadata stored on a message reply relation. It has no lifecycle outside MessageReplyTo.quote.
Rejected:
- table: The selected embedded decision stores this shape through MessageReplyTo.quote; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: textQuote(text:formattedText, position:int32, is_manual:Bool)
- update use: updateActiveLiveLocationMessages via MessageReplyTo; updateActiveNotifications via MessageReplyTo; updateBusinessMessageEdited via MessageReplyTo; updateChatLastMessage via MessageReplyTo; updateChatReplyMarkup via MessageReplyTo; updateDirectMessagesChatTopic via MessageReplyTo; updateFileAddedToDownloads via MessageReplyTo; updateMessageSendFailed via MessageReplyTo; updateMessageSendSucceeded via MessageReplyTo; updateNewBusinessCallbackQuery via MessageReplyTo; updateNewBusinessMessage via MessageReplyTo; updateNewChat via MessageReplyTo; updateNewGuestQuery via MessageReplyTo; updateNewMessage via MessageReplyTo; updateNotification via MessageReplyTo; updateNotificationGroup via MessageReplyTo; updateSavedMessagesTopic via MessageReplyTo
- type use: MessageReplyTo.quote; businessMessage via MessageReplyTo; businessMessages via MessageReplyTo; chat via MessageReplyTo; chatEvent via MessageReplyTo; chatEventMessageDeleted via MessageReplyTo; chatEventMessageEdited via MessageReplyTo; chatEventMessagePinned via MessageReplyTo; chatEventMessageUnpinned via MessageReplyTo; chatEventPollStopped via MessageReplyTo; chatEvents via MessageReplyTo; directMessagesChatTopic via MessageReplyTo; fileDownload via MessageReplyTo; forumTopic via MessageReplyTo; forumTopics via MessageReplyTo; foundChatMessages via MessageReplyTo; foundFileDownloads via MessageReplyTo; foundMessages via MessageReplyTo; foundPublicPosts via MessageReplyTo; message via MessageReplyTo; messageCalendar via MessageReplyTo; messageCalendarDay via MessageReplyTo; messageLinkInfo via MessageReplyTo; messageThreadInfo via MessageReplyTo; messages via MessageReplyTo; plus 9 more schema references
- procedures: addLocalMessage via MessageReplyTo; addOffer via MessageReplyTo; createBasicGroupChat via MessageReplyTo; createNewSecretChat via MessageReplyTo; createNewSupergroupChat via MessageReplyTo; createPrivateChat via MessageReplyTo; createSecretChat via MessageReplyTo; createSupergroupChat via MessageReplyTo; editBusinessMessageCaption via MessageReplyTo; editBusinessMessageChecklist via MessageReplyTo; editBusinessMessageLiveLocation via MessageReplyTo; editBusinessMessageMedia via MessageReplyTo; editBusinessMessageReplyMarkup via MessageReplyTo; editBusinessMessageText via MessageReplyTo; editMessageCaption via MessageReplyTo; editMessageChecklist via MessageReplyTo; editMessageLiveLocation via MessageReplyTo; editMessageMedia via MessageReplyTo; editMessageReplyMarkup via MessageReplyTo; editMessageText via MessageReplyTo; forwardMessages via MessageReplyTo; getCallbackQueryMessage via MessageReplyTo; getChat via MessageReplyTo; getChatEventLog via MessageReplyTo; getChatHistory via MessageReplyTo; getChatMessageByDate via MessageReplyTo; getChatMessageCalendar via MessageReplyTo; getChatPinnedMessage via MessageReplyTo; getChatScheduledMessages via MessageReplyTo; getChatStoryInteractions via MessageReplyTo; getDirectMessagesChatTopic via MessageReplyTo; getDirectMessagesChatTopicHistory via MessageReplyTo; getDirectMessagesChatTopicMessageByDate via MessageReplyTo; getForumTopic via MessageReplyTo; getForumTopicHistory via MessageReplyTo; getForumTopics via MessageReplyTo; plus 37 more schema references
```

### ThemeSettings

```text
Type: ThemeSettings
Storage: embedded
Storage target: EmojiChatTheme.light_settings, EmojiChatTheme.dark_settings, GiftChatTheme.light_settings, GiftChatTheme.dark_settings, LinkPreviewType.settings
Decision: This is visual theme settings stored in chat theme and link-preview owners. It has no row identity outside those owner fields.
Rejected:
- table: The selected embedded decision stores this shape through EmojiChatTheme.light_settings, EmojiChatTheme.dark_settings, GiftChatTheme.light_settings, GiftChatTheme.dark_settings, LinkPreviewType.settings; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: themeSettings(base_theme:BuiltInTheme, accent_color:int32, background:background, outgoing_message_fill:BackgroundFill, animate_outgoing_message_fill:Bool, outgoing_message_accent_color:int32)
- update use: updateActiveLiveLocationMessages via GiftChatTheme/LinkPreviewType; updateActiveNotifications via GiftChatTheme/LinkPreviewType; updateBusinessMessageEdited via GiftChatTheme/LinkPreviewType; updateChatLastMessage via GiftChatTheme/LinkPreviewType; updateChatReplyMarkup via GiftChatTheme/LinkPreviewType; updateChatTheme via GiftChatTheme; updateDirectMessagesChatTopic via GiftChatTheme/LinkPreviewType; updateEmojiChatThemes via EmojiChatTheme; updateFileAddedToDownloads via GiftChatTheme/LinkPreviewType; updateMessageContent via GiftChatTheme/LinkPreviewType; updateMessageSendFailed via GiftChatTheme/LinkPreviewType; updateMessageSendSucceeded via GiftChatTheme/LinkPreviewType; updateNewBusinessCallbackQuery via GiftChatTheme/LinkPreviewType; updateNewBusinessMessage via GiftChatTheme/LinkPreviewType; updateNewChat via GiftChatTheme/LinkPreviewType; updateNewGuestQuery via GiftChatTheme/LinkPreviewType; updateNewMessage via GiftChatTheme/LinkPreviewType; updateNotification via GiftChatTheme/LinkPreviewType; updateNotificationGroup via GiftChatTheme/LinkPreviewType; updatePoll via GiftChatTheme/LinkPreviewType; updateQuickReplyShortcut via GiftChatTheme/LinkPreviewType; updateQuickReplyShortcutMessages via GiftChatTheme/LinkPreviewType; updateSavedMessagesTopic via GiftChatTheme/LinkPreviewType; updateServiceNotification via GiftChatTheme/LinkPreviewType
- type use: EmojiChatTheme.dark_settings; EmojiChatTheme.light_settings; GiftChatTheme.dark_settings; GiftChatTheme.light_settings; LinkPreviewType.settings; businessMessage via GiftChatTheme/LinkPreviewType; businessMessages via GiftChatTheme/LinkPreviewType; chat via GiftChatTheme/LinkPreviewType; chatEvent via GiftChatTheme/LinkPreviewType; chatEventMessageDeleted via GiftChatTheme/LinkPreviewType; chatEventMessageEdited via GiftChatTheme/LinkPreviewType; chatEventMessagePinned via GiftChatTheme/LinkPreviewType; chatEventMessageUnpinned via GiftChatTheme/LinkPreviewType; chatEventPollStopped via GiftChatTheme/LinkPreviewType; chatEvents via GiftChatTheme/LinkPreviewType; chatThemeGift via GiftChatTheme; directMessagesChatTopic via GiftChatTheme/LinkPreviewType; fileDownload via GiftChatTheme/LinkPreviewType; forumTopic via GiftChatTheme/LinkPreviewType; forumTopics via GiftChatTheme/LinkPreviewType; foundChatMessages via GiftChatTheme/LinkPreviewType; foundFileDownloads via GiftChatTheme/LinkPreviewType; foundMessages via GiftChatTheme/LinkPreviewType; foundPublicPosts via GiftChatTheme/LinkPreviewType; giftChatThemes via GiftChatTheme; linkPreview via LinkPreviewType; message via GiftChatTheme/LinkPreviewType; messageCalendar via GiftChatTheme/LinkPreviewType; messageCalendarDay via GiftChatTheme/LinkPreviewType; plus 24 more schema references
- procedures: addLocalMessage via GiftChatTheme/LinkPreviewType; addOffer via GiftChatTheme/LinkPreviewType; addQuickReplyShortcutInlineQueryResultMessage via GiftChatTheme/LinkPreviewType; addQuickReplyShortcutMessage via GiftChatTheme/LinkPreviewType; addQuickReplyShortcutMessageAlbum via GiftChatTheme/LinkPreviewType; createBasicGroupChat via GiftChatTheme/LinkPreviewType; createNewSecretChat via GiftChatTheme/LinkPreviewType; createNewSupergroupChat via GiftChatTheme/LinkPreviewType; createPrivateChat via GiftChatTheme/LinkPreviewType; createSecretChat via GiftChatTheme/LinkPreviewType; createSupergroupChat via GiftChatTheme/LinkPreviewType; editBusinessMessageCaption via GiftChatTheme/LinkPreviewType; editBusinessMessageChecklist via GiftChatTheme/LinkPreviewType; editBusinessMessageLiveLocation via GiftChatTheme/LinkPreviewType; editBusinessMessageMedia via GiftChatTheme/LinkPreviewType; editBusinessMessageReplyMarkup via GiftChatTheme/LinkPreviewType; editBusinessMessageText via GiftChatTheme/LinkPreviewType; editMessageCaption via GiftChatTheme/LinkPreviewType; editMessageChecklist via GiftChatTheme/LinkPreviewType; editMessageLiveLocation via GiftChatTheme/LinkPreviewType; editMessageMedia via GiftChatTheme/LinkPreviewType; editMessageReplyMarkup via GiftChatTheme/LinkPreviewType; editMessageText via GiftChatTheme/LinkPreviewType; forwardMessages via GiftChatTheme/LinkPreviewType; getCallbackQueryMessage via GiftChatTheme/LinkPreviewType; getChat via GiftChatTheme/LinkPreviewType; getChatEventLog via GiftChatTheme/LinkPreviewType; getChatHistory via GiftChatTheme/LinkPreviewType; getChatMessageByDate via GiftChatTheme/LinkPreviewType; getChatMessageCalendar via GiftChatTheme/LinkPreviewType; getChatPinnedMessage via GiftChatTheme/LinkPreviewType; getChatScheduledMessages via GiftChatTheme/LinkPreviewType; getChatSponsoredMessages via GiftChatTheme/LinkPreviewType; getChatStoryInteractions via GiftChatTheme/LinkPreviewType; getDirectMessagesChatTopic via GiftChatTheme/LinkPreviewType; getDirectMessagesChatTopicHistory via GiftChatTheme/LinkPreviewType; plus 44 more schema references
```

### Thumbnail

```text
Type: Thumbnail
Storage: embedded
Storage target: Animation.thumbnail, Audio.album_cover_thumbnail, Audio.external_album_covers, Document.thumbnail, InlineQueryResult.thumbnail, Sticker.thumbnail, StickerSet.thumbnail, StickerSetInfo.thumbnail, StoryVideo.thumbnail, Video.thumbnail, VideoNote.thumbnail
Decision: This is thumbnail metadata embedded in media owners. The nested File owns file identity; Thumbnail itself has no standalone lifecycle.
Rejected:
- table: The selected embedded decision stores this shape through Animation.thumbnail, Audio.album_cover_thumbnail, Audio.external_album_covers, Document.thumbnail, InlineQueryResult.thumbnail, Sticker.thumbnail, StickerSet.thumbnail, StickerSetInfo.thumbnail, StoryVideo.thumbnail, Video.thumbnail, VideoNote.thumbnail; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: thumbnail(format:ThumbnailFormat, width:int32, height:int32, file:file)
- update use: updateActiveGiftAuctions via Sticker; updateActiveLiveLocationMessages via Animation/Audio/Document/Sticker/Video/VideoNote; updateActiveNotifications via Animation/Audio/Document/Sticker/Video/VideoNote; updateAnimatedEmojiMessageClicked via Sticker; updateBusinessMessageEdited via Animation/Audio/Document/Sticker/Video/VideoNote; updateChatBackground via Document; updateChatLastMessage via Animation/Audio/Document/Sticker/Video/VideoNote; updateChatReplyMarkup via Animation/Audio/Document/Sticker/Video/VideoNote; updateChatTheme via Document/Sticker; updateDefaultBackground via Document; updateDirectMessagesChatTopic via Animation/Audio/Document/Sticker/Video/VideoNote; updateEmojiChatThemes via Document; updateFileAddedToDownloads via Animation/Audio/Document/Sticker/Video/VideoNote; updateGiftAuctionState via Sticker; updateMessageContent via Animation/Audio/Document/Sticker/Video/VideoNote; updateMessageSendFailed via Animation/Audio/Document/Sticker/Video/VideoNote; updateMessageSendSucceeded via Animation/Audio/Document/Sticker/Video/VideoNote; updateNewBusinessCallbackQuery via Animation/Audio/Document/Sticker/Video/VideoNote; updateNewBusinessMessage via Animation/Audio/Document/Sticker/Video/VideoNote; updateNewChat via Animation/Audio/Document/Sticker/Video/VideoNote; updateNewGuestQuery via Animation/Audio/Document/Sticker/Video/VideoNote; updateNewMessage via Animation/Audio/Document/Sticker/Video/VideoNote; updateNotification via Animation/Audio/Document/Sticker/Video/VideoNote; updateNotificationGroup via Animation/Audio/Document/Sticker/Video/VideoNote; plus 11 more schema references
- type use: Animation.thumbnail; Audio.album_cover_thumbnail; Audio.external_album_covers; Document.thumbnail; InlineQueryResult.thumbnail; Sticker.thumbnail; StickerSet.thumbnail; StickerSetInfo.thumbnail; StoryVideo.thumbnail; Video.thumbnail; VideoNote.thumbnail; animatedEmoji via Sticker; animations via Animation; audios via Audio; availableGift via Sticker; availableGifts via Sticker; background via Document; backgrounds via Document; botInfo via Animation; botMediaPreview via StoryVideo; botMediaPreviewInfo via StoryVideo; botMediaPreviews via StoryVideo; botWriteAccessAllowReasonLaunchedWebApp via Animation; businessFeaturePromotionAnimation via Animation; businessInfo via Sticker; businessMessage via Animation/Audio/Document/Sticker/Video/VideoNote; businessMessages via Animation/Audio/Document/Sticker/Video/VideoNote; businessStartPage via Sticker; chat via Animation/Audio/Document/Sticker/Video/VideoNote; chatBackground via Document; chatEvent via Animation/Audio/Document/Sticker/Video/VideoNote; chatEventBackgroundChanged via Document; chatEventMessageDeleted via Animation/Audio/Document/Sticker/Video/VideoNote; chatEventMessageEdited via Animation/Audio/Document/Sticker/Video/VideoNote; chatEventMessagePinned via Animation/Audio/Document/Sticker/Video/VideoNote; plus 222 more schema references
- procedures: addBotMediaPreview via StoryVideo; addGiftCollectionGifts via Sticker; addLocalMessage via Animation/Audio/Document/Sticker/Video/VideoNote; addOffer via Animation/Audio/Document/Sticker/Video/VideoNote; addQuickReplyShortcutInlineQueryResultMessage via Animation/Audio/Document/Sticker/Video/VideoNote; addQuickReplyShortcutMessage via Animation/Audio/Document/Sticker/Video/VideoNote; addQuickReplyShortcutMessageAlbum via Animation/Audio/Document/Sticker/Video/VideoNote; addRecentSticker via Sticker; addStoryAlbumStories via Video; clickAnimatedEmojiMessage via Sticker; craftGift via Sticker; createBasicGroupChat via Animation/Audio/Document/Sticker/Video/VideoNote; createGiftCollection via Sticker; createNewSecretChat via Animation/Audio/Document/Sticker/Video/VideoNote; createNewStickerSet via Sticker/StickerSet; createNewSupergroupChat via Animation/Audio/Document/Sticker/Video/VideoNote; createPrivateChat via Animation/Audio/Document/Sticker/Video/VideoNote; createSecretChat via Animation/Audio/Document/Sticker/Video/VideoNote; createStoryAlbum via Video; createSupergroupChat via Animation/Audio/Document/Sticker/Video/VideoNote; editBotMediaPreview via StoryVideo; editBusinessMessageCaption via Animation/Audio/Document/Sticker/Video/VideoNote; editBusinessMessageChecklist via Animation/Audio/Document/Sticker/Video/VideoNote; editBusinessMessageLiveLocation via Animation/Audio/Document/Sticker/Video/VideoNote; editBusinessMessageMedia via Animation/Audio/Document/Sticker/Video/VideoNote; editBusinessMessageReplyMarkup via Animation/Audio/Document/Sticker/Video/VideoNote; editBusinessMessageText via Animation/Audio/Document/Sticker/Video/VideoNote; editBusinessStory via StoryVideo; editMessageCaption via Animation/Audio/Document/Sticker/Video/VideoNote; editMessageChecklist via Animation/Audio/Document/Sticker/Video/VideoNote; editMessageLiveLocation via Animation/Audio/Document/Sticker/Video/VideoNote; editMessageMedia via Animation/Audio/Document/Sticker/Video/VideoNote; editMessageReplyMarkup via Animation/Audio/Document/Sticker/Video/VideoNote; editMessageText via Animation/Audio/Document/Sticker/Video/VideoNote; forwardMessages via Animation/Audio/Document/Sticker/Video/VideoNote; getAnimatedEmoji via Sticker; plus 126 more schema references
```

### ThumbnailFormat

```text
Type: ThumbnailFormat
Storage: embedded
Storage target: Thumbnail.format
Decision: This is the file-format value for a Thumbnail. It has no identity outside Thumbnail.format.
Rejected:
- table: The selected embedded decision stores this shape through Thumbnail.format; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: thumbnailFormatGif(); thumbnailFormatJpeg(); thumbnailFormatMpeg4(); thumbnailFormatPng(); thumbnailFormatTgs(); thumbnailFormatWebm(); thumbnailFormatWebp()
- update use: updateActiveGiftAuctions via Thumbnail; updateActiveLiveLocationMessages via Thumbnail; updateActiveNotifications via Thumbnail; updateAnimatedEmojiMessageClicked via Thumbnail; updateBusinessMessageEdited via Thumbnail; updateChatBackground via Thumbnail; updateChatLastMessage via Thumbnail; updateChatReplyMarkup via Thumbnail; updateChatTheme via Thumbnail; updateDefaultBackground via Thumbnail; updateDirectMessagesChatTopic via Thumbnail; updateEmojiChatThemes via Thumbnail; updateFileAddedToDownloads via Thumbnail; updateGiftAuctionState via Thumbnail; updateMessageContent via Thumbnail; updateMessageSendFailed via Thumbnail; updateMessageSendSucceeded via Thumbnail; updateNewBusinessCallbackQuery via Thumbnail; updateNewBusinessMessage via Thumbnail; updateNewChat via Thumbnail; updateNewGuestQuery via Thumbnail; updateNewMessage via Thumbnail; updateNotification via Thumbnail; updateNotificationGroup via Thumbnail; plus 11 more schema references
- type use: Thumbnail.format; animatedEmoji via Thumbnail; animation via Thumbnail; animations via Thumbnail; audio via Thumbnail; audios via Thumbnail; availableGift via Thumbnail; availableGifts via Thumbnail; background via Thumbnail; backgrounds via Thumbnail; botInfo via Thumbnail; botMediaPreview via Thumbnail; botMediaPreviewInfo via Thumbnail; botMediaPreviews via Thumbnail; botWriteAccessAllowReasonLaunchedWebApp via Thumbnail; businessFeaturePromotionAnimation via Thumbnail; businessInfo via Thumbnail; businessMessage via Thumbnail; businessMessages via Thumbnail; businessStartPage via Thumbnail; chat via Thumbnail; chatBackground via Thumbnail; chatEvent via Thumbnail; chatEventBackgroundChanged via Thumbnail; chatEventMessageDeleted via Thumbnail; plus 235 more schema references
- procedures: addBotMediaPreview via Thumbnail; addGiftCollectionGifts via Thumbnail; addLocalMessage via Thumbnail; addOffer via Thumbnail; addQuickReplyShortcutInlineQueryResultMessage via Thumbnail; addQuickReplyShortcutMessage via Thumbnail; addQuickReplyShortcutMessageAlbum via Thumbnail; addRecentSticker via Thumbnail; addStoryAlbumStories via Thumbnail; clickAnimatedEmojiMessage via Thumbnail; craftGift via Thumbnail; createBasicGroupChat via Thumbnail; createGiftCollection via Thumbnail; createNewSecretChat via Thumbnail; createNewStickerSet via Thumbnail; createNewSupergroupChat via Thumbnail; createPrivateChat via Thumbnail; createSecretChat via Thumbnail; createStoryAlbum via Thumbnail; createSupergroupChat via Thumbnail; editBotMediaPreview via Thumbnail; editBusinessMessageCaption via Thumbnail; editBusinessMessageChecklist via Thumbnail; editBusinessMessageLiveLocation via Thumbnail; editBusinessMessageMedia via Thumbnail; editBusinessMessageReplyMarkup via Thumbnail; editBusinessMessageText via Thumbnail; editBusinessStory via Thumbnail; editMessageCaption via Thumbnail; editMessageChecklist via Thumbnail; editMessageLiveLocation via Thumbnail; editMessageMedia via Thumbnail; editMessageReplyMarkup via Thumbnail; editMessageText via Thumbnail; forwardMessages via Thumbnail; getAnimatedEmoji via Thumbnail; plus 126 more schema references
```

### TonRevenueStatus

```text
Type: TonRevenueStatus
Storage: kv
Storage target: ton_revenue_status
Decision: This is account-level Toncoin revenue status delivered by updateTonRevenueStatus and returned through TonRevenueStatistics. It is keyed by the account-level revenue status name, not by a domain entity id.
Rejected:
- table: The selected kv decision stores this shape through ton_revenue_status; it does not require its own independently addressed table row.
- embedded: The selected kv decision has a separate storage shape through ton_revenue_status; treating it as only an owner field would lose the update or identity shape.
- extend: The selected kv decision is not a one-to-one structural extension of a single owner row.
- facet: The selected kv decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected kv decision is not stored only as a key/value association between two TDLib types.
- event: The selected kv decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: tonRevenueStatus(total_amount:int64, balance_amount:int64, available_amount:int64, withdrawal_enabled:Bool)
- update use: updateTonRevenueStatus.status
- type use: TonRevenueStatistics.status
- procedures: getTonRevenueStatistics via TonRevenueStatistics
```

### TrendingStickerSets

```text
Type: TrendingStickerSets
Storage: kv
Storage target: trending_sticker_sets_by_type
Decision: This is an account-level trending sticker-set cache keyed by StickerType. updateTrendingStickerSets replaces the cached prefix for one sticker type.
Rejected:
- table: The selected kv decision stores this shape through trending_sticker_sets_by_type; it does not require its own independently addressed table row.
- embedded: The selected kv decision has a separate storage shape through trending_sticker_sets_by_type; treating it as only an owner field would lose the update or identity shape.
- extend: The selected kv decision is not a one-to-one structural extension of a single owner row.
- facet: The selected kv decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected kv decision is not stored only as a key/value association between two TDLib types.
- event: The selected kv decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: trendingStickerSets(total_count:int32, sets:vector<stickerSetInfo>, is_premium:Bool)
- update use: updateTrendingStickerSets.sticker_sets
- type use: none
- procedures: getTrendingStickerSets -> TrendingStickerSets
```

### UnconfirmedSession

```text
Type: UnconfirmedSession
Storage: kv
Storage target: unconfirmed_session
Decision: This is the account-level first unconfirmed session snapshot delivered by updateUnconfirmedSession. The update replaces or clears the singleton pending-session value.
Rejected:
- table: The selected kv decision stores this shape through unconfirmed_session; it does not require its own independently addressed table row.
- embedded: The selected kv decision has a separate storage shape through unconfirmed_session; treating it as only an owner field would lose the update or identity shape.
- extend: The selected kv decision is not a one-to-one structural extension of a single owner row.
- facet: The selected kv decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected kv decision is not stored only as a key/value association between two TDLib types.
- event: The selected kv decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: unconfirmedSession(id:int64, log_in_date:int32, device_model:string, location:string)
- update use: updateUnconfirmedSession.session
- type use: none
- procedures: none
```

### UnreadReaction

```text
Type: UnreadReaction
Storage: embedded
Storage target: Message.unread_reactions
Decision: This is one unread-reaction value stored on a Message. updateMessageUnreadReactions replaces the owning message field by chat_id and message_id.
Rejected:
- table: The selected embedded decision stores this shape through Message.unread_reactions; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: unreadReaction(type:ReactionType, sender_id:MessageSender, is_big:Bool)
- update use: updateMessageUnreadReactions.unread_reactions; updateActiveLiveLocationMessages via Message; updateActiveNotifications via Message; updateBusinessMessageEdited via Message; updateChatLastMessage via Message; updateChatReplyMarkup via Message; updateDirectMessagesChatTopic via Message; updateFileAddedToDownloads via Message; updateMessageSendFailed via Message; updateMessageSendSucceeded via Message; updateNewBusinessCallbackQuery via Message; updateNewBusinessMessage via Message; updateNewChat via Message; updateNewGuestQuery via Message; updateNewMessage via Message; updateNotification via Message; updateNotificationGroup via Message; updateSavedMessagesTopic via Message
- type use: Message.unread_reactions; businessMessage via Message; businessMessages via Message; chat via Message; chatEvent via Message; chatEventMessageDeleted via Message; chatEventMessageEdited via Message; chatEventMessagePinned via Message; chatEventMessageUnpinned via Message; chatEventPollStopped via Message; chatEvents via Message; directMessagesChatTopic via Message; fileDownload via Message; forumTopic via Message; forumTopics via Message; foundChatMessages via Message; foundFileDownloads via Message; foundMessages via Message; foundPublicPosts via Message; messageCalendar via Message; messageCalendarDay via Message; messageLinkInfo via Message; messageThreadInfo via Message; messages via Message; notification via Message; plus 8 more schema references
- procedures: addLocalMessage via Message; addOffer via Message; createBasicGroupChat via Message; createNewSecretChat via Message; createNewSupergroupChat via Message; createPrivateChat via Message; createSecretChat via Message; createSupergroupChat via Message; editBusinessMessageCaption via Message; editBusinessMessageChecklist via Message; editBusinessMessageLiveLocation via Message; editBusinessMessageMedia via Message; editBusinessMessageReplyMarkup via Message; editBusinessMessageText via Message; editMessageCaption via Message; editMessageChecklist via Message; editMessageLiveLocation via Message; editMessageMedia via Message; editMessageReplyMarkup via Message; editMessageText via Message; forwardMessages via Message; getCallbackQueryMessage via Message; getChat via Message; getChatEventLog via Message; getChatHistory via Message; getChatMessageByDate via Message; getChatMessageCalendar via Message; getChatPinnedMessage via Message; getChatScheduledMessages via Message; getChatStoryInteractions via Message; getDirectMessagesChatTopic via Message; getDirectMessagesChatTopicHistory via Message; getDirectMessagesChatTopicMessageByDate via Message; getForumTopic via Message; getForumTopicHistory via Message; getForumTopics via Message; plus 37 more schema references
```

### UpgradedGift

```text
Type: UpgradedGift
Storage: table
Storage target: id
Decision: This is the canonical upgraded gift entity keyed by UpgradedGift.id. getUpgradedGift and message, transaction, link-preview, and gift-theme owners can reference the same upgraded gift payload.
Rejected:
- embedded: The selected table decision has a separate storage shape through id; treating it as only an owner field would lose the update or identity shape.
- extend: The selected table decision is not a one-to-one structural extension of a single owner row.
- facet: The selected table decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected table decision is not stored only as a key/value association between two TDLib types.
- kv: The selected table decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected table decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: upgradedGift(id:int64, regular_gift_id:int64, publisher_chat_id:int53, title:string, name:string, number:int32, total_upgraded_count:int32, max_upgraded_count:int32, is_burned:Bool, is_crafted:Bool, is_premium:Bool, is_theme_available:Bool, used_theme_chat_id:int53, host_id:MessageSender, owner_id:MessageSender, owner_address:string, owner_name:string, gift_address:string, model:upgradedGiftModel, symbol:upgradedGiftSymbol, backdrop:upgradedGiftBackdrop, original_details:upgradedGiftOriginalDetails, colors:upgradedGiftColors, resale_parameters:giftResaleParameters, can_send_purchase_offer:Bool, craft_probability_per_mille:int32, value_currency:string, value_amount:int53, value_usd_amount:int53)
- update use: updateActiveLiveLocationMessages via GiftChatTheme/LinkPreviewType/MessageContent; updateActiveNotifications via GiftChatTheme/LinkPreviewType/MessageContent; updateBusinessMessageEdited via GiftChatTheme/LinkPreviewType/MessageContent; updateChatLastMessage via GiftChatTheme/LinkPreviewType/MessageContent; updateChatReplyMarkup via GiftChatTheme/LinkPreviewType/MessageContent; updateChatTheme via GiftChatTheme; updateDirectMessagesChatTopic via GiftChatTheme/LinkPreviewType/MessageContent; updateFileAddedToDownloads via GiftChatTheme/LinkPreviewType/MessageContent; updateMessageContent via GiftChatTheme/LinkPreviewType/MessageContent; updateMessageSendFailed via GiftChatTheme/LinkPreviewType/MessageContent; updateMessageSendSucceeded via GiftChatTheme/LinkPreviewType/MessageContent; updateNewBusinessCallbackQuery via GiftChatTheme/LinkPreviewType/MessageContent; updateNewBusinessMessage via GiftChatTheme/LinkPreviewType/MessageContent; updateNewChat via GiftChatTheme/LinkPreviewType/MessageContent; updateNewGuestQuery via GiftChatTheme/LinkPreviewType/MessageContent; updateNewMessage via GiftChatTheme/LinkPreviewType/MessageContent; updateNotification via GiftChatTheme/LinkPreviewType/MessageContent; updateNotificationGroup via GiftChatTheme/LinkPreviewType/MessageContent; updatePoll via GiftChatTheme/LinkPreviewType/MessageContent; updateQuickReplyShortcut via GiftChatTheme/LinkPreviewType/MessageContent; updateQuickReplyShortcutMessages via GiftChatTheme/LinkPreviewType/MessageContent; updateSavedMessagesTopic via GiftChatTheme/LinkPreviewType/MessageContent; updateServiceNotification via GiftChatTheme/LinkPreviewType/MessageContent
- type use: CraftGiftResult.gift; GiftChatTheme.gift; GiftForResale.gift; LinkPreviewType.gift; MessageContent.gift; SentGift.gift; StarTransactionType.gift; TonTransactionType.gift; UpgradeGiftResult.gift; businessMessage via GiftChatTheme/LinkPreviewType/MessageContent; businessMessages via GiftChatTheme/LinkPreviewType/MessageContent; chat via GiftChatTheme/LinkPreviewType/MessageContent; chatEvent via GiftChatTheme/LinkPreviewType/MessageContent; chatEventMessageDeleted via GiftChatTheme/LinkPreviewType/MessageContent; chatEventMessageEdited via GiftChatTheme/LinkPreviewType/MessageContent; chatEventMessagePinned via GiftChatTheme/LinkPreviewType/MessageContent; chatEventMessageUnpinned via GiftChatTheme/LinkPreviewType/MessageContent; chatEventPollStopped via GiftChatTheme/LinkPreviewType/MessageContent; chatEvents via GiftChatTheme/LinkPreviewType/MessageContent; chatThemeGift via GiftChatTheme; directMessagesChatTopic via GiftChatTheme/LinkPreviewType/MessageContent; fileDownload via GiftChatTheme/LinkPreviewType/MessageContent; forumTopic via GiftChatTheme/LinkPreviewType/MessageContent; forumTopics via GiftChatTheme/LinkPreviewType/MessageContent; foundChatMessages via GiftChatTheme/LinkPreviewType/MessageContent; foundFileDownloads via GiftChatTheme/LinkPreviewType/MessageContent; foundMessages via GiftChatTheme/LinkPreviewType/MessageContent; foundPublicPosts via GiftChatTheme/LinkPreviewType/MessageContent; giftChatThemes via GiftChatTheme; giftsForCrafting via SentGift; giftsForResale via GiftForResale; linkPreview via LinkPreviewType; message via GiftChatTheme/LinkPreviewType/MessageContent; plus 32 more schema references
- procedures: addLocalMessage via GiftChatTheme/LinkPreviewType/MessageContent; addOffer via GiftChatTheme/LinkPreviewType/MessageContent; addQuickReplyShortcutInlineQueryResultMessage via GiftChatTheme/LinkPreviewType/MessageContent; addQuickReplyShortcutMessage via GiftChatTheme/LinkPreviewType/MessageContent; addQuickReplyShortcutMessageAlbum via GiftChatTheme/LinkPreviewType/MessageContent; craftGift via CraftGiftResult; createBasicGroupChat via GiftChatTheme/LinkPreviewType/MessageContent; createNewSecretChat via GiftChatTheme/LinkPreviewType/MessageContent; createNewSupergroupChat via GiftChatTheme/LinkPreviewType/MessageContent; createPrivateChat via GiftChatTheme/LinkPreviewType/MessageContent; createSecretChat via GiftChatTheme/LinkPreviewType/MessageContent; createSupergroupChat via GiftChatTheme/LinkPreviewType/MessageContent; editBusinessMessageCaption via GiftChatTheme/LinkPreviewType/MessageContent; editBusinessMessageChecklist via GiftChatTheme/LinkPreviewType/MessageContent; editBusinessMessageLiveLocation via GiftChatTheme/LinkPreviewType/MessageContent; editBusinessMessageMedia via GiftChatTheme/LinkPreviewType/MessageContent; editBusinessMessageReplyMarkup via GiftChatTheme/LinkPreviewType/MessageContent; editBusinessMessageText via GiftChatTheme/LinkPreviewType/MessageContent; editMessageCaption via GiftChatTheme/LinkPreviewType/MessageContent; editMessageChecklist via GiftChatTheme/LinkPreviewType/MessageContent; editMessageLiveLocation via GiftChatTheme/LinkPreviewType/MessageContent; editMessageMedia via GiftChatTheme/LinkPreviewType/MessageContent; editMessageReplyMarkup via GiftChatTheme/LinkPreviewType/MessageContent; editMessageText via GiftChatTheme/LinkPreviewType/MessageContent; forwardMessages via GiftChatTheme/LinkPreviewType/MessageContent; getCallbackQueryMessage via GiftChatTheme/LinkPreviewType/MessageContent; getChat via GiftChatTheme/LinkPreviewType/MessageContent; getChatEventLog via GiftChatTheme/LinkPreviewType/MessageContent; getChatHistory via GiftChatTheme/LinkPreviewType/MessageContent; getChatMessageByDate via GiftChatTheme/LinkPreviewType/MessageContent; getChatMessageCalendar via GiftChatTheme/LinkPreviewType/MessageContent; getChatPinnedMessage via GiftChatTheme/LinkPreviewType/MessageContent; getChatScheduledMessages via GiftChatTheme/LinkPreviewType/MessageContent; getChatSponsoredMessages via GiftChatTheme/LinkPreviewType/MessageContent; getChatStoryInteractions via GiftChatTheme/LinkPreviewType/MessageContent; getDirectMessagesChatTopic via GiftChatTheme/LinkPreviewType/MessageContent; plus 53 more schema references
```

### UpgradedGiftAttributeRarity

```text
Type: UpgradedGiftAttributeRarity
Storage: embedded
Storage target: UpgradedGiftBackdrop.rarity, UpgradedGiftModel.rarity, UpgradedGiftSymbol.rarity
Decision: This is rarity metadata for upgraded gift attributes. It has no identity outside the owning attribute value.
Rejected:
- table: The selected embedded decision stores this shape through UpgradedGiftBackdrop.rarity, UpgradedGiftModel.rarity, UpgradedGiftSymbol.rarity; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: upgradedGiftAttributeRarityEpic(); upgradedGiftAttributeRarityLegendary(); upgradedGiftAttributeRarityPerMille(per_mille:int32); upgradedGiftAttributeRarityRare(); upgradedGiftAttributeRarityUncommon()
- update use: updateActiveLiveLocationMessages via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateActiveNotifications via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateBusinessMessageEdited via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateChatLastMessage via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateChatReplyMarkup via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateChatTheme via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateDirectMessagesChatTopic via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateFileAddedToDownloads via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateMessageContent via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateMessageSendFailed via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateMessageSendSucceeded via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateNewBusinessCallbackQuery via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateNewBusinessMessage via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateNewChat via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateNewGuestQuery via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateNewMessage via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateNotification via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateNotificationGroup via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updatePoll via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateQuickReplyShortcut via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateQuickReplyShortcutMessages via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateSavedMessagesTopic via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; updateServiceNotification via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol
- type use: UpgradedGiftBackdrop.rarity; UpgradedGiftModel.rarity; UpgradedGiftSymbol.rarity; businessMessage via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; businessMessages via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; chat via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; chatEvent via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; chatEventMessageDeleted via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; chatEventMessageEdited via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; chatEventMessagePinned via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; chatEventMessageUnpinned via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; chatEventPollStopped via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; chatEvents via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; chatThemeGift via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; craftGiftResultSuccess via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; directMessagesChatTopic via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; fileDownload via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; forumTopic via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; forumTopics via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; foundChatMessages via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; foundFileDownloads via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; foundMessages via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; foundPublicPosts via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; giftChatTheme via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; giftChatThemes via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; giftForResale via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; giftUpgradePreview via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; plus 56 more schema references
- procedures: addLocalMessage via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; addOffer via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; addQuickReplyShortcutInlineQueryResultMessage via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; addQuickReplyShortcutMessage via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; addQuickReplyShortcutMessageAlbum via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; craftGift via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; createBasicGroupChat via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; createNewSecretChat via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; createNewSupergroupChat via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; createPrivateChat via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; createSecretChat via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; createSupergroupChat via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; editBusinessMessageCaption via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; editBusinessMessageChecklist via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; editBusinessMessageLiveLocation via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; editBusinessMessageMedia via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; editBusinessMessageReplyMarkup via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; editBusinessMessageText via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; editMessageCaption via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; editMessageChecklist via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; editMessageLiveLocation via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; editMessageMedia via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; editMessageReplyMarkup via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; editMessageText via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; forwardMessages via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; getCallbackQueryMessage via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; getChat via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; getChatEventLog via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; getChatHistory via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; getChatMessageByDate via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; getChatMessageCalendar via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; getChatPinnedMessage via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; getChatScheduledMessages via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; getChatSponsoredMessages via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; getChatStoryInteractions via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; getDirectMessagesChatTopic via UpgradedGiftBackdrop/UpgradedGiftModel/UpgradedGiftSymbol; plus 55 more schema references
```

### UpgradedGiftBackdrop

```text
Type: UpgradedGiftBackdrop
Storage: embedded
Storage target: GiftUpgradePreview.backdrops, GiftUpgradeVariants.backdrops, UpgradedGift.backdrop, UpgradedGiftBackdropCount.backdrop
Decision: This is backdrop attribute metadata embedded in upgraded gifts, previews, variants, and counts. It has no independently updated row lifecycle.
Rejected:
- table: The selected embedded decision stores this shape through GiftUpgradePreview.backdrops, GiftUpgradeVariants.backdrops, UpgradedGift.backdrop, UpgradedGiftBackdropCount.backdrop; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: upgradedGiftBackdrop(id:int32, name:string, colors:upgradedGiftBackdropColors, rarity:UpgradedGiftAttributeRarity)
- update use: updateActiveLiveLocationMessages via UpgradedGift; updateActiveNotifications via UpgradedGift; updateBusinessMessageEdited via UpgradedGift; updateChatLastMessage via UpgradedGift; updateChatReplyMarkup via UpgradedGift; updateChatTheme via UpgradedGift; updateDirectMessagesChatTopic via UpgradedGift; updateFileAddedToDownloads via UpgradedGift; updateMessageContent via UpgradedGift; updateMessageSendFailed via UpgradedGift; updateMessageSendSucceeded via UpgradedGift; updateNewBusinessCallbackQuery via UpgradedGift; updateNewBusinessMessage via UpgradedGift; updateNewChat via UpgradedGift; updateNewGuestQuery via UpgradedGift; updateNewMessage via UpgradedGift; updateNotification via UpgradedGift; updateNotificationGroup via UpgradedGift; updatePoll via UpgradedGift; updateQuickReplyShortcut via UpgradedGift; updateQuickReplyShortcutMessages via UpgradedGift; updateSavedMessagesTopic via UpgradedGift; updateServiceNotification via UpgradedGift
- type use: GiftUpgradePreview.backdrops; GiftUpgradeVariants.backdrops; UpgradedGift.backdrop; UpgradedGiftBackdropCount.backdrop; businessMessage via UpgradedGift; businessMessages via UpgradedGift; chat via UpgradedGift; chatEvent via UpgradedGift; chatEventMessageDeleted via UpgradedGift; chatEventMessageEdited via UpgradedGift; chatEventMessagePinned via UpgradedGift; chatEventMessageUnpinned via UpgradedGift; chatEventPollStopped via UpgradedGift; chatEvents via UpgradedGift; chatThemeGift via UpgradedGift; craftGiftResultSuccess via UpgradedGift; directMessagesChatTopic via UpgradedGift; fileDownload via UpgradedGift; forumTopic via UpgradedGift; forumTopics via UpgradedGift; foundChatMessages via UpgradedGift; foundFileDownloads via UpgradedGift; foundMessages via UpgradedGift; foundPublicPosts via UpgradedGift; giftChatTheme via UpgradedGift; giftChatThemes via UpgradedGift; giftForResale via UpgradedGift; giftsForCrafting via UpgradedGift; plus 50 more schema references
- procedures: addLocalMessage via UpgradedGift; addOffer via UpgradedGift; addQuickReplyShortcutInlineQueryResultMessage via UpgradedGift; addQuickReplyShortcutMessage via UpgradedGift; addQuickReplyShortcutMessageAlbum via UpgradedGift; craftGift via UpgradedGift; createBasicGroupChat via UpgradedGift; createNewSecretChat via UpgradedGift; createNewSupergroupChat via UpgradedGift; createPrivateChat via UpgradedGift; createSecretChat via UpgradedGift; createSupergroupChat via UpgradedGift; editBusinessMessageCaption via UpgradedGift; editBusinessMessageChecklist via UpgradedGift; editBusinessMessageLiveLocation via UpgradedGift; editBusinessMessageMedia via UpgradedGift; editBusinessMessageReplyMarkup via UpgradedGift; editBusinessMessageText via UpgradedGift; editMessageCaption via UpgradedGift; editMessageChecklist via UpgradedGift; editMessageLiveLocation via UpgradedGift; editMessageMedia via UpgradedGift; editMessageReplyMarkup via UpgradedGift; editMessageText via UpgradedGift; forwardMessages via UpgradedGift; getCallbackQueryMessage via UpgradedGift; getChat via UpgradedGift; getChatEventLog via UpgradedGift; getChatHistory via UpgradedGift; getChatMessageByDate via UpgradedGift; getChatMessageCalendar via UpgradedGift; getChatPinnedMessage via UpgradedGift; getChatScheduledMessages via UpgradedGift; getChatSponsoredMessages via UpgradedGift; getChatStoryInteractions via UpgradedGift; getDirectMessagesChatTopic via UpgradedGift; plus 55 more schema references
```

### UpgradedGiftBackdropColors

```text
Type: UpgradedGiftBackdropColors
Storage: embedded
Storage target: EmojiStatusType.backdrop_colors, UpgradedGiftBackdrop.colors
Decision: This is color metadata for emoji status and upgraded gift backdrop values. It has no identity outside the owning value.
Rejected:
- table: The selected embedded decision stores this shape through EmojiStatusType.backdrop_colors, UpgradedGiftBackdrop.colors; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: upgradedGiftBackdropColors(center_color:int32, edge_color:int32, symbol_color:int32, text_color:int32)
- update use: updateActiveLiveLocationMessages via UpgradedGiftBackdrop; updateActiveNotifications via UpgradedGiftBackdrop; updateBusinessMessageEdited via UpgradedGiftBackdrop; updateChatEmojiStatus via EmojiStatusType; updateChatLastMessage via UpgradedGiftBackdrop; updateChatReplyMarkup via UpgradedGiftBackdrop; updateChatTheme via UpgradedGiftBackdrop; updateDirectMessagesChatTopic via UpgradedGiftBackdrop; updateFileAddedToDownloads via UpgradedGiftBackdrop; updateMessageContent via UpgradedGiftBackdrop; updateMessageSendFailed via UpgradedGiftBackdrop; updateMessageSendSucceeded via UpgradedGiftBackdrop; updateNewBusinessCallbackQuery via UpgradedGiftBackdrop; updateNewBusinessMessage via UpgradedGiftBackdrop; updateNewChat via EmojiStatusType/UpgradedGiftBackdrop; updateNewGuestQuery via UpgradedGiftBackdrop; updateNewMessage via UpgradedGiftBackdrop; updateNotification via UpgradedGiftBackdrop; updateNotificationGroup via UpgradedGiftBackdrop; updatePoll via UpgradedGiftBackdrop; updateQuickReplyShortcut via UpgradedGiftBackdrop; updateQuickReplyShortcutMessages via UpgradedGiftBackdrop; updateSavedMessagesTopic via UpgradedGiftBackdrop; updateServiceNotification via UpgradedGiftBackdrop; plus 1 more schema references
- type use: EmojiStatusType.backdrop_colors; UpgradedGiftBackdrop.colors; businessMessage via UpgradedGiftBackdrop; businessMessages via UpgradedGiftBackdrop; chat via EmojiStatusType/UpgradedGiftBackdrop; chatEvent via EmojiStatusType/UpgradedGiftBackdrop; chatEventEmojiStatusChanged via EmojiStatusType; chatEventMessageDeleted via UpgradedGiftBackdrop; chatEventMessageEdited via UpgradedGiftBackdrop; chatEventMessagePinned via UpgradedGiftBackdrop; chatEventMessageUnpinned via UpgradedGiftBackdrop; chatEventPollStopped via UpgradedGiftBackdrop; chatEvents via EmojiStatusType/UpgradedGiftBackdrop; chatThemeGift via UpgradedGiftBackdrop; craftGiftResultSuccess via UpgradedGiftBackdrop; directMessagesChatTopic via UpgradedGiftBackdrop; emojiStatus via EmojiStatusType; emojiStatuses via EmojiStatusType; fileDownload via UpgradedGiftBackdrop; forumTopic via UpgradedGiftBackdrop; forumTopics via UpgradedGiftBackdrop; foundChatMessages via UpgradedGiftBackdrop; foundFileDownloads via UpgradedGiftBackdrop; foundMessages via UpgradedGiftBackdrop; foundPublicPosts via UpgradedGiftBackdrop; giftChatTheme via UpgradedGiftBackdrop; plus 58 more schema references
- procedures: addLocalMessage via UpgradedGiftBackdrop; addOffer via UpgradedGiftBackdrop; addQuickReplyShortcutInlineQueryResultMessage via UpgradedGiftBackdrop; addQuickReplyShortcutMessage via UpgradedGiftBackdrop; addQuickReplyShortcutMessageAlbum via UpgradedGiftBackdrop; craftGift via UpgradedGiftBackdrop; createBasicGroupChat via EmojiStatusType/UpgradedGiftBackdrop; createBot via EmojiStatusType; createNewSecretChat via EmojiStatusType/UpgradedGiftBackdrop; createNewSupergroupChat via EmojiStatusType/UpgradedGiftBackdrop; createPrivateChat via EmojiStatusType/UpgradedGiftBackdrop; createSecretChat via EmojiStatusType/UpgradedGiftBackdrop; createSupergroupChat via EmojiStatusType/UpgradedGiftBackdrop; editBusinessMessageCaption via UpgradedGiftBackdrop; editBusinessMessageChecklist via UpgradedGiftBackdrop; editBusinessMessageLiveLocation via UpgradedGiftBackdrop; editBusinessMessageMedia via UpgradedGiftBackdrop; editBusinessMessageReplyMarkup via UpgradedGiftBackdrop; editBusinessMessageText via UpgradedGiftBackdrop; editMessageCaption via UpgradedGiftBackdrop; editMessageChecklist via UpgradedGiftBackdrop; editMessageLiveLocation via UpgradedGiftBackdrop; editMessageMedia via UpgradedGiftBackdrop; editMessageReplyMarkup via UpgradedGiftBackdrop; editMessageText via UpgradedGiftBackdrop; forwardMessages via UpgradedGiftBackdrop; getCallbackQueryMessage via UpgradedGiftBackdrop; getChat via EmojiStatusType/UpgradedGiftBackdrop; getChatEventLog via EmojiStatusType/UpgradedGiftBackdrop; getChatHistory via UpgradedGiftBackdrop; getChatMessageByDate via UpgradedGiftBackdrop; getChatMessageCalendar via UpgradedGiftBackdrop; getChatOwnerAfterLeaving via EmojiStatusType; getChatPinnedMessage via UpgradedGiftBackdrop; getChatScheduledMessages via UpgradedGiftBackdrop; getChatSponsoredMessages via UpgradedGiftBackdrop; plus 68 more schema references
```

### UpgradedGiftColors

```text
Type: UpgradedGiftColors
Storage: embedded
Storage target: Chat.upgraded_gift_colors, User.upgraded_gift_colors, UpgradedGift.colors
Decision: This is an upgraded-gift color scheme stored on chat, user, or upgraded gift owners. The id is a selector inside those owner fields, not a separately updated catalog row in this schema.
Rejected:
- table: The selected embedded decision stores this shape through Chat.upgraded_gift_colors, User.upgraded_gift_colors, UpgradedGift.colors; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: upgradedGiftColors(id:int64, model_custom_emoji_id:int64, symbol_custom_emoji_id:int64, light_theme_accent_color:int32, light_theme_colors:vector<int32>, dark_theme_accent_color:int32, dark_theme_colors:vector<int32>)
- update use: updateChatAccentColors.upgraded_gift_colors; updateActiveLiveLocationMessages via UpgradedGift; updateActiveNotifications via UpgradedGift; updateBusinessMessageEdited via UpgradedGift; updateChatLastMessage via UpgradedGift; updateChatReplyMarkup via UpgradedGift; updateChatTheme via UpgradedGift; updateDirectMessagesChatTopic via UpgradedGift; updateFileAddedToDownloads via UpgradedGift; updateMessageContent via UpgradedGift; updateMessageSendFailed via UpgradedGift; updateMessageSendSucceeded via UpgradedGift; updateNewBusinessCallbackQuery via UpgradedGift; updateNewBusinessMessage via UpgradedGift; updateNewChat via Chat/UpgradedGift; updateNewGuestQuery via UpgradedGift; updateNewMessage via UpgradedGift; updateNotification via UpgradedGift; updateNotificationGroup via UpgradedGift; updatePoll via UpgradedGift; updateQuickReplyShortcut via UpgradedGift; updateQuickReplyShortcutMessages via UpgradedGift; updateSavedMessagesTopic via UpgradedGift; updateServiceNotification via UpgradedGift; updateUser via User
- type use: Chat.upgraded_gift_colors; UpgradedGift.colors; User.upgraded_gift_colors; businessMessage via UpgradedGift; businessMessages via UpgradedGift; chatEvent via UpgradedGift; chatEventMessageDeleted via UpgradedGift; chatEventMessageEdited via UpgradedGift; chatEventMessagePinned via UpgradedGift; chatEventMessageUnpinned via UpgradedGift; chatEventPollStopped via UpgradedGift; chatEvents via UpgradedGift; chatThemeGift via UpgradedGift; craftGiftResultSuccess via UpgradedGift; directMessagesChatTopic via UpgradedGift; fileDownload via UpgradedGift; forumTopic via UpgradedGift; forumTopics via UpgradedGift; foundChatMessages via UpgradedGift; foundFileDownloads via UpgradedGift; foundMessages via UpgradedGift; foundPublicPosts via UpgradedGift; giftChatTheme via UpgradedGift; giftChatThemes via UpgradedGift; giftForResale via UpgradedGift; giftsForCrafting via UpgradedGift; giftsForResale via UpgradedGift; plus 49 more schema references
- procedures: addLocalMessage via UpgradedGift; addOffer via UpgradedGift; addQuickReplyShortcutInlineQueryResultMessage via UpgradedGift; addQuickReplyShortcutMessage via UpgradedGift; addQuickReplyShortcutMessageAlbum via UpgradedGift; craftGift via UpgradedGift; createBasicGroupChat via Chat/UpgradedGift; createBot via User; createNewSecretChat via Chat/UpgradedGift; createNewSupergroupChat via Chat/UpgradedGift; createPrivateChat via Chat/UpgradedGift; createSecretChat via Chat/UpgradedGift; createSupergroupChat via Chat/UpgradedGift; editBusinessMessageCaption via UpgradedGift; editBusinessMessageChecklist via UpgradedGift; editBusinessMessageLiveLocation via UpgradedGift; editBusinessMessageMedia via UpgradedGift; editBusinessMessageReplyMarkup via UpgradedGift; editBusinessMessageText via UpgradedGift; editMessageCaption via UpgradedGift; editMessageChecklist via UpgradedGift; editMessageLiveLocation via UpgradedGift; editMessageMedia via UpgradedGift; editMessageReplyMarkup via UpgradedGift; editMessageText via UpgradedGift; forwardMessages via UpgradedGift; getCallbackQueryMessage via UpgradedGift; getChat via Chat/UpgradedGift; getChatEventLog via UpgradedGift; getChatHistory via UpgradedGift; getChatMessageByDate via UpgradedGift; getChatMessageCalendar via UpgradedGift; getChatOwnerAfterLeaving via User; getChatPinnedMessage via UpgradedGift; getChatScheduledMessages via UpgradedGift; getChatSponsoredMessages via UpgradedGift; plus 61 more schema references
```

### UpgradedGiftModel

```text
Type: UpgradedGiftModel
Storage: embedded
Storage target: GiftUpgradePreview.models, GiftUpgradeVariants.models, UpgradedGift.model, UpgradedGiftModelCount.model
Decision: This is model attribute metadata embedded in upgraded gifts, previews, variants, and counts. It has no independently updated row lifecycle.
Rejected:
- table: The selected embedded decision stores this shape through GiftUpgradePreview.models, GiftUpgradeVariants.models, UpgradedGift.model, UpgradedGiftModelCount.model; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: upgradedGiftModel(name:string, sticker:sticker, rarity:UpgradedGiftAttributeRarity, is_crafted:Bool)
- update use: updateActiveLiveLocationMessages via UpgradedGift; updateActiveNotifications via UpgradedGift; updateBusinessMessageEdited via UpgradedGift; updateChatLastMessage via UpgradedGift; updateChatReplyMarkup via UpgradedGift; updateChatTheme via UpgradedGift; updateDirectMessagesChatTopic via UpgradedGift; updateFileAddedToDownloads via UpgradedGift; updateMessageContent via UpgradedGift; updateMessageSendFailed via UpgradedGift; updateMessageSendSucceeded via UpgradedGift; updateNewBusinessCallbackQuery via UpgradedGift; updateNewBusinessMessage via UpgradedGift; updateNewChat via UpgradedGift; updateNewGuestQuery via UpgradedGift; updateNewMessage via UpgradedGift; updateNotification via UpgradedGift; updateNotificationGroup via UpgradedGift; updatePoll via UpgradedGift; updateQuickReplyShortcut via UpgradedGift; updateQuickReplyShortcutMessages via UpgradedGift; updateSavedMessagesTopic via UpgradedGift; updateServiceNotification via UpgradedGift
- type use: GiftUpgradePreview.models; GiftUpgradeVariants.models; UpgradedGift.model; UpgradedGiftModelCount.model; businessMessage via UpgradedGift; businessMessages via UpgradedGift; chat via UpgradedGift; chatEvent via UpgradedGift; chatEventMessageDeleted via UpgradedGift; chatEventMessageEdited via UpgradedGift; chatEventMessagePinned via UpgradedGift; chatEventMessageUnpinned via UpgradedGift; chatEventPollStopped via UpgradedGift; chatEvents via UpgradedGift; chatThemeGift via UpgradedGift; craftGiftResultSuccess via UpgradedGift; directMessagesChatTopic via UpgradedGift; fileDownload via UpgradedGift; forumTopic via UpgradedGift; forumTopics via UpgradedGift; foundChatMessages via UpgradedGift; foundFileDownloads via UpgradedGift; foundMessages via UpgradedGift; foundPublicPosts via UpgradedGift; giftChatTheme via UpgradedGift; giftChatThemes via UpgradedGift; giftForResale via UpgradedGift; giftsForCrafting via UpgradedGift; plus 50 more schema references
- procedures: addLocalMessage via UpgradedGift; addOffer via UpgradedGift; addQuickReplyShortcutInlineQueryResultMessage via UpgradedGift; addQuickReplyShortcutMessage via UpgradedGift; addQuickReplyShortcutMessageAlbum via UpgradedGift; craftGift via UpgradedGift; createBasicGroupChat via UpgradedGift; createNewSecretChat via UpgradedGift; createNewSupergroupChat via UpgradedGift; createPrivateChat via UpgradedGift; createSecretChat via UpgradedGift; createSupergroupChat via UpgradedGift; editBusinessMessageCaption via UpgradedGift; editBusinessMessageChecklist via UpgradedGift; editBusinessMessageLiveLocation via UpgradedGift; editBusinessMessageMedia via UpgradedGift; editBusinessMessageReplyMarkup via UpgradedGift; editBusinessMessageText via UpgradedGift; editMessageCaption via UpgradedGift; editMessageChecklist via UpgradedGift; editMessageLiveLocation via UpgradedGift; editMessageMedia via UpgradedGift; editMessageReplyMarkup via UpgradedGift; editMessageText via UpgradedGift; forwardMessages via UpgradedGift; getCallbackQueryMessage via UpgradedGift; getChat via UpgradedGift; getChatEventLog via UpgradedGift; getChatHistory via UpgradedGift; getChatMessageByDate via UpgradedGift; getChatMessageCalendar via UpgradedGift; getChatPinnedMessage via UpgradedGift; getChatScheduledMessages via UpgradedGift; getChatSponsoredMessages via UpgradedGift; getChatStoryInteractions via UpgradedGift; getDirectMessagesChatTopic via UpgradedGift; plus 55 more schema references
```

### UpgradedGiftOrigin

```text
Type: UpgradedGiftOrigin
Storage: embedded
Storage target: MessageContent.origin
Decision: This is the origin payload for upgraded-gift message content. It has no identity outside the message content.
Rejected:
- table: The selected embedded decision stores this shape through MessageContent.origin; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: upgradedGiftOriginBlockchain(); upgradedGiftOriginCraft(); upgradedGiftOriginOffer(price:GiftResalePrice); upgradedGiftOriginPrepaidUpgrade(); upgradedGiftOriginResale(price:GiftResalePrice); upgradedGiftOriginTransfer(); upgradedGiftOriginUpgrade(gift_message_id:int53)
- update use: updateActiveLiveLocationMessages via MessageContent; updateActiveNotifications via MessageContent; updateBusinessMessageEdited via MessageContent; updateChatLastMessage via MessageContent; updateChatReplyMarkup via MessageContent; updateDirectMessagesChatTopic via MessageContent; updateFileAddedToDownloads via MessageContent; updateMessageContent via MessageContent; updateMessageSendFailed via MessageContent; updateMessageSendSucceeded via MessageContent; updateNewBusinessCallbackQuery via MessageContent; updateNewBusinessMessage via MessageContent; updateNewChat via MessageContent; updateNewGuestQuery via MessageContent; updateNewMessage via MessageContent; updateNotification via MessageContent; updateNotificationGroup via MessageContent; updatePoll via MessageContent; updateQuickReplyShortcut via MessageContent; updateQuickReplyShortcutMessages via MessageContent; updateSavedMessagesTopic via MessageContent; updateServiceNotification via MessageContent
- type use: MessageContent.origin; businessMessage via MessageContent; businessMessages via MessageContent; chat via MessageContent; chatEvent via MessageContent; chatEventMessageDeleted via MessageContent; chatEventMessageEdited via MessageContent; chatEventMessagePinned via MessageContent; chatEventMessageUnpinned via MessageContent; chatEventPollStopped via MessageContent; chatEvents via MessageContent; directMessagesChatTopic via MessageContent; fileDownload via MessageContent; forumTopic via MessageContent; forumTopics via MessageContent; foundChatMessages via MessageContent; foundFileDownloads via MessageContent; foundMessages via MessageContent; foundPublicPosts via MessageContent; message via MessageContent; messageCalendar via MessageContent; messageCalendarDay via MessageContent; messageLinkInfo via MessageContent; messagePoll via MessageContent; messageReplyToMessage via MessageContent; plus 19 more schema references
- procedures: addLocalMessage via MessageContent; addOffer via MessageContent; addQuickReplyShortcutInlineQueryResultMessage via MessageContent; addQuickReplyShortcutMessage via MessageContent; addQuickReplyShortcutMessageAlbum via MessageContent; createBasicGroupChat via MessageContent; createNewSecretChat via MessageContent; createNewSupergroupChat via MessageContent; createPrivateChat via MessageContent; createSecretChat via MessageContent; createSupergroupChat via MessageContent; editBusinessMessageCaption via MessageContent; editBusinessMessageChecklist via MessageContent; editBusinessMessageLiveLocation via MessageContent; editBusinessMessageMedia via MessageContent; editBusinessMessageReplyMarkup via MessageContent; editBusinessMessageText via MessageContent; editMessageCaption via MessageContent; editMessageChecklist via MessageContent; editMessageLiveLocation via MessageContent; editMessageMedia via MessageContent; editMessageReplyMarkup via MessageContent; editMessageText via MessageContent; forwardMessages via MessageContent; getCallbackQueryMessage via MessageContent; getChat via MessageContent; getChatEventLog via MessageContent; getChatHistory via MessageContent; getChatMessageByDate via MessageContent; getChatMessageCalendar via MessageContent; getChatPinnedMessage via MessageContent; getChatScheduledMessages via MessageContent; getChatSponsoredMessages via MessageContent; getChatStoryInteractions via MessageContent; getDirectMessagesChatTopic via MessageContent; getDirectMessagesChatTopicHistory via MessageContent; plus 42 more schema references
```

### UpgradedGiftOriginalDetails

```text
Type: UpgradedGiftOriginalDetails
Storage: embedded
Storage target: UpgradedGift.original_details
Decision: This is original sender, receiver, text, and date metadata stored on an UpgradedGift. It has no identity outside the upgraded gift owner.
Rejected:
- table: The selected embedded decision stores this shape through UpgradedGift.original_details; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: upgradedGiftOriginalDetails(sender_id:MessageSender, receiver_id:MessageSender, text:formattedText, date:int32)
- update use: updateActiveLiveLocationMessages via UpgradedGift; updateActiveNotifications via UpgradedGift; updateBusinessMessageEdited via UpgradedGift; updateChatLastMessage via UpgradedGift; updateChatReplyMarkup via UpgradedGift; updateChatTheme via UpgradedGift; updateDirectMessagesChatTopic via UpgradedGift; updateFileAddedToDownloads via UpgradedGift; updateMessageContent via UpgradedGift; updateMessageSendFailed via UpgradedGift; updateMessageSendSucceeded via UpgradedGift; updateNewBusinessCallbackQuery via UpgradedGift; updateNewBusinessMessage via UpgradedGift; updateNewChat via UpgradedGift; updateNewGuestQuery via UpgradedGift; updateNewMessage via UpgradedGift; updateNotification via UpgradedGift; updateNotificationGroup via UpgradedGift; updatePoll via UpgradedGift; updateQuickReplyShortcut via UpgradedGift; updateQuickReplyShortcutMessages via UpgradedGift; updateSavedMessagesTopic via UpgradedGift; updateServiceNotification via UpgradedGift
- type use: UpgradedGift.original_details; businessMessage via UpgradedGift; businessMessages via UpgradedGift; chat via UpgradedGift; chatEvent via UpgradedGift; chatEventMessageDeleted via UpgradedGift; chatEventMessageEdited via UpgradedGift; chatEventMessagePinned via UpgradedGift; chatEventMessageUnpinned via UpgradedGift; chatEventPollStopped via UpgradedGift; chatEvents via UpgradedGift; chatThemeGift via UpgradedGift; craftGiftResultSuccess via UpgradedGift; directMessagesChatTopic via UpgradedGift; fileDownload via UpgradedGift; forumTopic via UpgradedGift; forumTopics via UpgradedGift; foundChatMessages via UpgradedGift; foundFileDownloads via UpgradedGift; foundMessages via UpgradedGift; foundPublicPosts via UpgradedGift; giftChatTheme via UpgradedGift; giftChatThemes via UpgradedGift; giftForResale via UpgradedGift; giftsForCrafting via UpgradedGift; plus 50 more schema references
- procedures: addLocalMessage via UpgradedGift; addOffer via UpgradedGift; addQuickReplyShortcutInlineQueryResultMessage via UpgradedGift; addQuickReplyShortcutMessage via UpgradedGift; addQuickReplyShortcutMessageAlbum via UpgradedGift; craftGift via UpgradedGift; createBasicGroupChat via UpgradedGift; createNewSecretChat via UpgradedGift; createNewSupergroupChat via UpgradedGift; createPrivateChat via UpgradedGift; createSecretChat via UpgradedGift; createSupergroupChat via UpgradedGift; editBusinessMessageCaption via UpgradedGift; editBusinessMessageChecklist via UpgradedGift; editBusinessMessageLiveLocation via UpgradedGift; editBusinessMessageMedia via UpgradedGift; editBusinessMessageReplyMarkup via UpgradedGift; editBusinessMessageText via UpgradedGift; editMessageCaption via UpgradedGift; editMessageChecklist via UpgradedGift; editMessageLiveLocation via UpgradedGift; editMessageMedia via UpgradedGift; editMessageReplyMarkup via UpgradedGift; editMessageText via UpgradedGift; forwardMessages via UpgradedGift; getCallbackQueryMessage via UpgradedGift; getChat via UpgradedGift; getChatEventLog via UpgradedGift; getChatHistory via UpgradedGift; getChatMessageByDate via UpgradedGift; getChatMessageCalendar via UpgradedGift; getChatPinnedMessage via UpgradedGift; getChatScheduledMessages via UpgradedGift; getChatSponsoredMessages via UpgradedGift; getChatStoryInteractions via UpgradedGift; getDirectMessagesChatTopic via UpgradedGift; plus 53 more schema references
```

### UpgradedGiftSymbol

```text
Type: UpgradedGiftSymbol
Storage: embedded
Storage target: GiftUpgradePreview.symbols, GiftUpgradeVariants.symbols, UpgradedGift.symbol, UpgradedGiftSymbolCount.symbol
Decision: This is symbol attribute metadata embedded in upgraded gifts, previews, variants, and counts. It has no independently updated row lifecycle.
Rejected:
- table: The selected embedded decision stores this shape through GiftUpgradePreview.symbols, GiftUpgradeVariants.symbols, UpgradedGift.symbol, UpgradedGiftSymbolCount.symbol; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: upgradedGiftSymbol(name:string, sticker:sticker, rarity:UpgradedGiftAttributeRarity)
- update use: updateActiveLiveLocationMessages via UpgradedGift; updateActiveNotifications via UpgradedGift; updateBusinessMessageEdited via UpgradedGift; updateChatLastMessage via UpgradedGift; updateChatReplyMarkup via UpgradedGift; updateChatTheme via UpgradedGift; updateDirectMessagesChatTopic via UpgradedGift; updateFileAddedToDownloads via UpgradedGift; updateMessageContent via UpgradedGift; updateMessageSendFailed via UpgradedGift; updateMessageSendSucceeded via UpgradedGift; updateNewBusinessCallbackQuery via UpgradedGift; updateNewBusinessMessage via UpgradedGift; updateNewChat via UpgradedGift; updateNewGuestQuery via UpgradedGift; updateNewMessage via UpgradedGift; updateNotification via UpgradedGift; updateNotificationGroup via UpgradedGift; updatePoll via UpgradedGift; updateQuickReplyShortcut via UpgradedGift; updateQuickReplyShortcutMessages via UpgradedGift; updateSavedMessagesTopic via UpgradedGift; updateServiceNotification via UpgradedGift
- type use: GiftUpgradePreview.symbols; GiftUpgradeVariants.symbols; UpgradedGift.symbol; UpgradedGiftSymbolCount.symbol; businessMessage via UpgradedGift; businessMessages via UpgradedGift; chat via UpgradedGift; chatEvent via UpgradedGift; chatEventMessageDeleted via UpgradedGift; chatEventMessageEdited via UpgradedGift; chatEventMessagePinned via UpgradedGift; chatEventMessageUnpinned via UpgradedGift; chatEventPollStopped via UpgradedGift; chatEvents via UpgradedGift; chatThemeGift via UpgradedGift; craftGiftResultSuccess via UpgradedGift; directMessagesChatTopic via UpgradedGift; fileDownload via UpgradedGift; forumTopic via UpgradedGift; forumTopics via UpgradedGift; foundChatMessages via UpgradedGift; foundFileDownloads via UpgradedGift; foundMessages via UpgradedGift; foundPublicPosts via UpgradedGift; giftChatTheme via UpgradedGift; giftChatThemes via UpgradedGift; giftForResale via UpgradedGift; giftsForCrafting via UpgradedGift; plus 50 more schema references
- procedures: addLocalMessage via UpgradedGift; addOffer via UpgradedGift; addQuickReplyShortcutInlineQueryResultMessage via UpgradedGift; addQuickReplyShortcutMessage via UpgradedGift; addQuickReplyShortcutMessageAlbum via UpgradedGift; craftGift via UpgradedGift; createBasicGroupChat via UpgradedGift; createNewSecretChat via UpgradedGift; createNewSupergroupChat via UpgradedGift; createPrivateChat via UpgradedGift; createSecretChat via UpgradedGift; createSupergroupChat via UpgradedGift; editBusinessMessageCaption via UpgradedGift; editBusinessMessageChecklist via UpgradedGift; editBusinessMessageLiveLocation via UpgradedGift; editBusinessMessageMedia via UpgradedGift; editBusinessMessageReplyMarkup via UpgradedGift; editBusinessMessageText via UpgradedGift; editMessageCaption via UpgradedGift; editMessageChecklist via UpgradedGift; editMessageLiveLocation via UpgradedGift; editMessageMedia via UpgradedGift; editMessageReplyMarkup via UpgradedGift; editMessageText via UpgradedGift; forwardMessages via UpgradedGift; getCallbackQueryMessage via UpgradedGift; getChat via UpgradedGift; getChatEventLog via UpgradedGift; getChatHistory via UpgradedGift; getChatMessageByDate via UpgradedGift; getChatMessageCalendar via UpgradedGift; getChatPinnedMessage via UpgradedGift; getChatScheduledMessages via UpgradedGift; getChatSponsoredMessages via UpgradedGift; getChatStoryInteractions via UpgradedGift; getDirectMessagesChatTopic via UpgradedGift; plus 55 more schema references
```

### User

```text
Type: User
Storage: table
Storage target: id
Decision: This is the canonical Telegram user row keyed by User.id. updateUser replaces that row and user procedures address users by user_id or return the same entity.
Rejected:
- embedded: The selected table decision has a separate storage shape through id; treating it as only an owner field would lose the update or identity shape.
- extend: The selected table decision is not a one-to-one structural extension of a single owner row.
- facet: The selected table decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected table decision is not stored only as a key/value association between two TDLib types.
- kv: The selected table decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected table decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: user(id:int53, first_name:string, last_name:string, usernames:usernames, phone_number:string, status:UserStatus, profile_photo:profilePhoto, accent_color_id:int32, background_custom_emoji_id:int64, upgraded_gift_colors:upgradedGiftColors, profile_accent_color_id:int32, profile_background_custom_emoji_id:int64, emoji_status:emojiStatus, is_contact:Bool, is_mutual_contact:Bool, is_close_friend:Bool, verification_status:verificationStatus, is_premium:Bool, is_support:Bool, restriction_info:restrictionInfo, active_story_state:ActiveStoryState, restricts_new_chats:Bool, paid_message_star_count:int53, have_access:Bool, type:UserType, language_code:string, added_to_attachment_menu:Bool)
- update use: updateUser.user
- type use: none
- procedures: createBot -> User; getChatOwnerAfterLeaving -> User; getMe -> User; getMessageAuthor -> User; getSupportUser -> User; getUser -> User; searchUserByPhoneNumber -> User; searchUserByToken -> User
```

### UserAuctionBid

```text
Type: UserAuctionBid
Storage: embedded
Storage target: AuctionState.user_bid
Decision: This is the current user bid payload inside auction state. It has no identity outside AuctionState.user_bid.
Rejected:
- table: The selected embedded decision stores this shape through AuctionState.user_bid; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: userAuctionBid(star_count:int53, bid_date:int32, next_bid_star_count:int53, owner_id:MessageSender, was_returned:Bool)
- update use: updateActiveGiftAuctions via AuctionState; updateGiftAuctionState via AuctionState
- type use: AuctionState.user_bid; giftAuctionState via AuctionState
- procedures: getGiftAuctionState via AuctionState
```

### UserFullInfo

```text
Type: UserFullInfo
Storage: extend
Storage target: User
Decision: This is full information for one User identified externally by user_id. It structurally extends the User row rather than forming a separate entity.
Rejected:
- table: The selected extend decision stores this shape through User; it does not require its own independently addressed table row.
- embedded: The selected extend decision has a separate storage shape through User; treating it as only an owner field would lose the update or identity shape.
- facet: The selected extend decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected extend decision is not stored only as a key/value association between two TDLib types.
- kv: The selected extend decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected extend decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: userFullInfo(personal_photo:chatPhoto, photo:chatPhoto, public_photo:chatPhoto, block_list:BlockList, can_be_called:Bool, supports_video_calls:Bool, has_private_calls:Bool, has_private_forwards:Bool, has_restricted_voice_and_video_note_messages:Bool, has_posted_to_profile_stories:Bool, has_sponsored_messages_enabled:Bool, need_phone_number_privacy_exception:Bool, set_chat_background:Bool, uses_unofficial_app:Bool, bio:formattedText, birthdate:birthdate, personal_chat_id:int53, gift_count:int32, group_in_common_count:int32, incoming_paid_message_star_count:int53, outgoing_paid_message_star_count:int53, gift_settings:giftSettings, bot_verification:botVerification, main_profile_tab:ProfileTab, first_profile_audio:audio, rating:userRating, pending_rating:userRating, pending_rating_date:int32, note:formattedText, business_info:businessInfo, bot_info:botInfo)
- update use: updateUserFullInfo.user_full_info
- type use: none
- procedures: getUserFullInfo -> UserFullInfo
```

### UserPrivacySetting

```text
Type: UserPrivacySetting
Storage: pair
Storage target: UserPrivacySetting => UserPrivacySettingRules
Decision: This is the key side of account privacy settings. updateUserPrivacySettingRules, getUserPrivacySettingRules, and setUserPrivacySettingRules store it only together with UserPrivacySettingRules.
Rejected:
- table: The selected pair decision stores this shape through UserPrivacySetting => UserPrivacySettingRules; it does not require its own independently addressed table row.
- embedded: The selected pair decision has a separate storage shape through UserPrivacySetting => UserPrivacySettingRules; treating it as only an owner field would lose the update or identity shape.
- extend: The selected pair decision is not a one-to-one structural extension of a single owner row.
- facet: The selected pair decision is not a separate owner-scoped aspect keyed only by an external owner id.
- kv: The selected pair decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected pair decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: userPrivacySettingAllowCalls(); userPrivacySettingAllowChatInvites(); userPrivacySettingAllowFindingByPhoneNumber(); userPrivacySettingAllowPeerToPeerCalls(); userPrivacySettingAllowPrivateVoiceAndVideoNoteMessages(); userPrivacySettingAllowUnpaidMessages(); userPrivacySettingAutosaveGifts(); userPrivacySettingShowBio(); userPrivacySettingShowBirthdate(); userPrivacySettingShowLinkInForwardedMessages(); userPrivacySettingShowPhoneNumber(); userPrivacySettingShowProfileAudio(); userPrivacySettingShowProfilePhoto(); userPrivacySettingShowStatus()
- update use: updateUserPrivacySettingRules.setting
- type use: none
- procedures: getUserPrivacySettingRules(setting); setUserPrivacySettingRules(setting)
```

### UserPrivacySettingRule

```text
Type: UserPrivacySettingRule
Storage: embedded
Storage target: UserPrivacySettingRules.rules
Decision: This is one privacy rule inside UserPrivacySettingRules. It has no identity outside the owning rules value.
Rejected:
- table: The selected embedded decision stores this shape through UserPrivacySettingRules.rules; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: userPrivacySettingRuleAllowAll(); userPrivacySettingRuleAllowBots(); userPrivacySettingRuleAllowChatMembers(chat_ids:vector<int53>); userPrivacySettingRuleAllowContacts(); userPrivacySettingRuleAllowPremiumUsers(); userPrivacySettingRuleAllowUsers(user_ids:vector<int53>); userPrivacySettingRuleRestrictAll(); userPrivacySettingRuleRestrictBots(); userPrivacySettingRuleRestrictChatMembers(chat_ids:vector<int53>); userPrivacySettingRuleRestrictContacts(); userPrivacySettingRuleRestrictUsers(user_ids:vector<int53>)
- update use: updateUserPrivacySettingRules via UserPrivacySettingRules
- type use: UserPrivacySettingRules.rules
- procedures: getUserPrivacySettingRules via UserPrivacySettingRules; setUserPrivacySettingRules via UserPrivacySettingRules
```

### UserPrivacySettingRules

```text
Type: UserPrivacySettingRules
Storage: pair
Storage target: UserPrivacySetting => UserPrivacySettingRules
Decision: This is the value side of account privacy settings. The rules are stored and replaced for a UserPrivacySetting key.
Rejected:
- table: The selected pair decision stores this shape through UserPrivacySetting => UserPrivacySettingRules; it does not require its own independently addressed table row.
- embedded: The selected pair decision has a separate storage shape through UserPrivacySetting => UserPrivacySettingRules; treating it as only an owner field would lose the update or identity shape.
- extend: The selected pair decision is not a one-to-one structural extension of a single owner row.
- facet: The selected pair decision is not a separate owner-scoped aspect keyed only by an external owner id.
- kv: The selected pair decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected pair decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: userPrivacySettingRules(rules:vector<UserPrivacySettingRule>)
- update use: updateUserPrivacySettingRules.rules
- type use: none
- procedures: getUserPrivacySettingRules -> UserPrivacySettingRules; setUserPrivacySettingRules(rules)
```

### UserRating

```text
Type: UserRating
Storage: embedded
Storage target: UserFullInfo.rating, UserFullInfo.pending_rating
Decision: This is rating metadata stored on UserFullInfo. It has no identity outside the owning user full-info field.
Rejected:
- table: The selected embedded decision stores this shape through UserFullInfo.rating, UserFullInfo.pending_rating; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: userRating(level:int32, is_maximum_level_reached:Bool, rating:int53, current_level_rating:int53, next_level_rating:int53)
- update use: updateUserFullInfo via UserFullInfo
- type use: UserFullInfo.pending_rating; UserFullInfo.rating
- procedures: getUserFullInfo via UserFullInfo
```

### UserStatus

```text
Type: UserStatus
Storage: embedded
Storage target: User.status
Decision: This is the current status value stored on a User. updateUserStatus replaces the User.status field by user_id.
Rejected:
- table: The selected embedded decision stores this shape through User.status; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: userStatusEmpty(); userStatusLastMonth(by_my_privacy_settings:Bool); userStatusLastWeek(by_my_privacy_settings:Bool); userStatusOffline(was_online:int32); userStatusOnline(expires:int32); userStatusRecently(by_my_privacy_settings:Bool)
- update use: updateUserStatus.status; updateUser via User
- type use: User.status
- procedures: createBot via User; getChatOwnerAfterLeaving via User; getMe via User; getMessageAuthor via User; getSupportUser via User; getUser via User; searchUserByPhoneNumber via User; searchUserByToken via User
```

### UserType

```text
Type: UserType
Storage: embedded
Storage target: User.type
Decision: This is the account-kind value stored on a User. It has no identity outside User.type.
Rejected:
- table: The selected embedded decision stores this shape through User.type; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: userTypeBot(can_be_edited:Bool, can_join_groups:Bool, can_read_all_group_messages:Bool, has_main_web_app:Bool, has_topics:Bool, allows_users_to_create_topics:Bool, can_manage_bots:Bool, is_inline:Bool, inline_query_placeholder:string, supports_guest_queries:Bool, need_location:Bool, can_connect_to_business:Bool, can_be_added_to_attachment_menu:Bool, active_user_count:int32); userTypeDeleted(); userTypeRegular(); userTypeUnknown()
- update use: updateUser via User
- type use: User.type
- procedures: createBot via User; getChatOwnerAfterLeaving via User; getMe via User; getMessageAuthor via User; getSupportUser via User; getUser via User; searchUserByPhoneNumber via User; searchUserByToken via User
```

### Usernames

```text
Type: Usernames
Storage: embedded
Storage target: Supergroup.usernames, User.usernames
Decision: This is username-list metadata stored on Supergroup and User owners. It has no standalone row identity.
Rejected:
- table: The selected embedded decision stores this shape through Supergroup.usernames, User.usernames; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: usernames(active_usernames:vector<string>, disabled_usernames:vector<string>, editable_username:string, collectible_usernames:vector<string>)
- update use: updateSupergroup via Supergroup; updateUser via User
- type use: Supergroup.usernames; User.usernames
- procedures: createBot via User; getChatOwnerAfterLeaving via User; getMe via User; getMessageAuthor via User; getSupergroup via Supergroup; getSupportUser via User; getUser via User; searchUserByPhoneNumber via User; searchUserByToken via User
```

### VectorPathCommand

```text
Type: VectorPathCommand
Storage: embedded
Storage target: ClosedVectorPath.commands
Decision: This is one drawing command inside a closed vector path. It has no identity outside the owning path command list.
Rejected:
- table: The selected embedded decision stores this shape through ClosedVectorPath.commands; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: vectorPathCommandCubicBezierCurve(start_control_point:point, end_control_point:point, end_point:point); vectorPathCommandLine(end_point:point)
- update use: updateStickerSet via ClosedVectorPath; updateTrendingStickerSets via ClosedVectorPath
- type use: ClosedVectorPath.commands; outline via ClosedVectorPath; stickerSet via ClosedVectorPath; stickerSetInfo via ClosedVectorPath; stickerSets via ClosedVectorPath; trendingStickerSets via ClosedVectorPath
- procedures: createNewStickerSet via ClosedVectorPath; getArchivedStickerSets via ClosedVectorPath; getAttachedStickerSets via ClosedVectorPath; getInstalledStickerSets via ClosedVectorPath; getOwnedStickerSets via ClosedVectorPath; getStickerOutline via ClosedVectorPath; getStickerSet via ClosedVectorPath; getTrendingStickerSets via ClosedVectorPath; getWebAppPlaceholder via ClosedVectorPath; searchInstalledStickerSets via ClosedVectorPath; searchStickerSet via ClosedVectorPath; searchStickerSets via ClosedVectorPath
```

### Venue

```text
Type: Venue
Storage: embedded
Storage target: InlineQueryResult.venue, InputInlineQueryResult.venue, InputMessageContent.venue, MessageContent.venue, StoryAreaType.venue
Decision: This is venue payload embedded in inline, input message, message content, and story-area owners. It has no standalone venue row identity in this schema.
Rejected:
- table: The selected embedded decision stores this shape through InlineQueryResult.venue, InputInlineQueryResult.venue, InputMessageContent.venue, MessageContent.venue, StoryAreaType.venue; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: venue(location:location, title:string, address:string, provider:string, id:string, type:string)
- update use: updateActiveLiveLocationMessages via MessageContent; updateActiveNotifications via MessageContent; updateBusinessMessageEdited via MessageContent; updateChatDraftMessage via InputMessageContent; updateChatLastMessage via MessageContent; updateChatReplyMarkup via MessageContent; updateDirectMessagesChatTopic via InputMessageContent/MessageContent; updateFileAddedToDownloads via MessageContent; updateForumTopic via InputMessageContent; updateMessageContent via MessageContent; updateMessageSendFailed via MessageContent; updateMessageSendSucceeded via MessageContent; updateNewBusinessCallbackQuery via MessageContent; updateNewBusinessMessage via MessageContent; updateNewChat via InputMessageContent/MessageContent; updateNewGuestQuery via MessageContent; updateNewMessage via MessageContent; updateNotification via MessageContent; updateNotificationGroup via MessageContent; updatePoll via MessageContent; updateQuickReplyShortcut via MessageContent; updateQuickReplyShortcutMessages via MessageContent; updateSavedMessagesTopic via InputMessageContent/MessageContent; updateServiceNotification via MessageContent; plus 3 more schema references
- type use: InlineQueryResult.venue; InputInlineQueryResult.venue; InputMessageContent.venue; MessageContent.venue; StoryAreaType.venue; businessMessage via MessageContent; businessMessages via MessageContent; chat via InputMessageContent/MessageContent; chatEvent via MessageContent; chatEventMessageDeleted via MessageContent; chatEventMessageEdited via MessageContent; chatEventMessagePinned via MessageContent; chatEventMessageUnpinned via MessageContent; chatEventPollStopped via MessageContent; chatEvents via MessageContent; directMessagesChatTopic via InputMessageContent/MessageContent; draftMessage via InputMessageContent; fileDownload via MessageContent; forumTopic via InputMessageContent/MessageContent; forumTopics via InputMessageContent/MessageContent; foundChatMessages via MessageContent; foundFileDownloads via MessageContent; foundMessages via MessageContent; foundPublicPosts via MessageContent; foundStories via StoryAreaType; inlineQueryResults via InlineQueryResult; inputInlineQueryResultAnimation via InputMessageContent; inputInlineQueryResultArticle via InputMessageContent; inputInlineQueryResultAudio via InputMessageContent; plus 42 more schema references
- procedures: addLocalMessage via InputMessageContent/MessageContent; addOffer via MessageContent; addPollOption via InputMessageContent; addQuickReplyShortcutInlineQueryResultMessage via MessageContent; addQuickReplyShortcutMessage via InputMessageContent/MessageContent; addQuickReplyShortcutMessageAlbum via InputMessageContent/MessageContent; answerGuestQuery via InputInlineQueryResult/InputMessageContent; answerInlineQuery via InputInlineQueryResult/InputMessageContent; answerWebAppQuery via InputInlineQueryResult/InputMessageContent; createBasicGroupChat via InputMessageContent/MessageContent; createInvoiceLink via InputMessageContent; createNewSecretChat via InputMessageContent/MessageContent; createNewSupergroupChat via InputMessageContent/MessageContent; createPrivateChat via InputMessageContent/MessageContent; createSecretChat via InputMessageContent/MessageContent; createSupergroupChat via InputMessageContent/MessageContent; editBusinessMessageCaption via MessageContent; editBusinessMessageChecklist via MessageContent; editBusinessMessageLiveLocation via MessageContent; editBusinessMessageMedia via InputMessageContent/MessageContent; editBusinessMessageReplyMarkup via MessageContent; editBusinessMessageText via InputMessageContent/MessageContent; editBusinessStory via StoryAreaType; editInlineMessageMedia via InputMessageContent; editInlineMessageText via InputMessageContent; editMessageCaption via MessageContent; editMessageChecklist via MessageContent; editMessageLiveLocation via MessageContent; editMessageMedia via InputMessageContent/MessageContent; editMessageReplyMarkup via MessageContent; editMessageText via InputMessageContent/MessageContent; editQuickReplyMessage via InputMessageContent; forwardMessages via MessageContent; getCallbackQueryMessage via MessageContent; getChat via InputMessageContent/MessageContent; getChatArchivedStories via StoryAreaType; plus 64 more schema references
```

### VerificationStatus

```text
Type: VerificationStatus
Storage: embedded
Storage target: ChatInviteLinkInfo.verification_status, Supergroup.verification_status, User.verification_status
Decision: This is verification and scam/fake status stored on invite-link info, supergroup, and user owners. It has no lifecycle outside those owner fields.
Rejected:
- table: The selected embedded decision stores this shape through ChatInviteLinkInfo.verification_status, Supergroup.verification_status, User.verification_status; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: verificationStatus(is_verified:Bool, is_scam:Bool, is_fake:Bool, bot_verification_icon_custom_emoji_id:int64)
- update use: updateSupergroup via Supergroup; updateUser via User
- type use: ChatInviteLinkInfo.verification_status; Supergroup.verification_status; User.verification_status; tMeUrl via ChatInviteLinkInfo; tMeUrlTypeChatInvite via ChatInviteLinkInfo; tMeUrls via ChatInviteLinkInfo
- procedures: checkChatInviteLink via ChatInviteLinkInfo; createBot via User; getChatOwnerAfterLeaving via User; getMe via User; getMessageAuthor via User; getRecentlyVisitedTMeUrls via ChatInviteLinkInfo; getSupergroup via Supergroup; getSupportUser via User; getUser via User; searchUserByPhoneNumber via User; searchUserByToken via User
```

### Video

```text
Type: Video
Storage: embedded
Storage target: InlineQueryResult.video, LinkPreviewAlbumMedia.video, LinkPreviewType.video, LinkPreviewType.video_icon, MessageContent.video, PageBlock.video, PaidMedia.video, PushMessageContent.video, StoryAlbum.video_icon
Decision: This is video media metadata embedded under message, paid-media, link-preview, inline, page-block, push, and story-album owners. The nested File owns file identity; Video itself has no standalone row identity.
Rejected:
- table: The selected embedded decision stores this shape through InlineQueryResult.video, LinkPreviewAlbumMedia.video, LinkPreviewType.video, LinkPreviewType.video_icon, MessageContent.video, PageBlock.video, PaidMedia.video, PushMessageContent.video, StoryAlbum.video_icon; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: video(duration:int32, width:int32, height:int32, file_name:string, mime_type:string, has_stickers:Bool, supports_streaming:Bool, minithumbnail:minithumbnail, thumbnail:thumbnail, video:file)
- update use: updateActiveLiveLocationMessages via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; updateActiveNotifications via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia/PushMessageContent; updateBusinessMessageEdited via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; updateChatLastMessage via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; updateChatReplyMarkup via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; updateDirectMessagesChatTopic via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; updateFileAddedToDownloads via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; updateMessageContent via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; updateMessageSendFailed via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; updateMessageSendSucceeded via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; updateNewBusinessCallbackQuery via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; updateNewBusinessMessage via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; updateNewChat via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; updateNewGuestQuery via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; updateNewMessage via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; updateNotification via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia/PushMessageContent; updateNotificationGroup via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia/PushMessageContent; updatePoll via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; updateQuickReplyShortcut via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; updateQuickReplyShortcutMessages via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; updateSavedMessagesTopic via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; updateServiceNotification via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia
- type use: InlineQueryResult.video; LinkPreviewAlbumMedia.video; LinkPreviewType.video; LinkPreviewType.video_icon; MessageContent.video; PageBlock.video; PaidMedia.video; PushMessageContent.video; StoryAlbum.video_icon; businessMessage via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; businessMessages via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; chat via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; chatEvent via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; chatEventMessageDeleted via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; chatEventMessageEdited via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; chatEventMessagePinned via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; chatEventMessageUnpinned via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; chatEventPollStopped via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; chatEvents via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; directMessagesChatTopic via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; fileDownload via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; forumTopic via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; forumTopics via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; foundChatMessages via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; foundFileDownloads via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; foundMessages via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; foundPublicPosts via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; inlineQueryResults via InlineQueryResult; linkPreview via LinkPreviewAlbumMedia/LinkPreviewType; linkPreviewTypeAlbum via LinkPreviewAlbumMedia; message via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; messageCalendar via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; messageCalendarDay via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; plus 42 more schema references
- procedures: addLocalMessage via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; addOffer via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; addQuickReplyShortcutInlineQueryResultMessage via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; addQuickReplyShortcutMessage via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; addQuickReplyShortcutMessageAlbum via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; addStoryAlbumStories via StoryAlbum; createBasicGroupChat via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; createNewSecretChat via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; createNewSupergroupChat via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; createPrivateChat via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; createSecretChat via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; createStoryAlbum via StoryAlbum; createSupergroupChat via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; editBusinessMessageCaption via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; editBusinessMessageChecklist via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; editBusinessMessageLiveLocation via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; editBusinessMessageMedia via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; editBusinessMessageReplyMarkup via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; editBusinessMessageText via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; editMessageCaption via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; editMessageChecklist via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; editMessageLiveLocation via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; editMessageMedia via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; editMessageReplyMarkup via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; editMessageText via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; forwardMessages via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; getCallbackQueryMessage via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; getChat via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; getChatEventLog via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; getChatHistory via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; getChatMessageByDate via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; getChatMessageCalendar via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; getChatPinnedMessage via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; getChatScheduledMessages via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; getChatSponsoredMessages via LinkPreviewAlbumMedia/LinkPreviewType/MessageContent/PaidMedia; getChatStoryAlbums via StoryAlbum; plus 53 more schema references
```

### VideoChat

```text
Type: VideoChat
Storage: embedded
Storage target: Chat.video_chat
Decision: This is video-chat state stored on a Chat. updateChatVideoChat replaces the Chat.video_chat field by chat_id.
Rejected:
- table: The selected embedded decision stores this shape through Chat.video_chat; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: videoChat(group_call_id:int32, has_participants:Bool, default_participant_id:MessageSender)
- update use: updateChatVideoChat.video_chat; updateNewChat via Chat
- type use: Chat.video_chat
- procedures: createBasicGroupChat via Chat; createNewSecretChat via Chat; createNewSupergroupChat via Chat; createPrivateChat via Chat; createSecretChat via Chat; createSupergroupChat via Chat; getChat via Chat; joinChatByInviteLink via Chat; searchChatAffiliateProgram via Chat; searchPublicChat via Chat; upgradeBasicGroupChatToSupergroupChat via Chat
```

### VideoNote

```text
Type: VideoNote
Storage: embedded
Storage target: LinkPreviewType.video_note, MessageContent.video_note, PushMessageContent.video_note
Decision: This is video-note media metadata embedded under link-preview, message, and push-content owners. The nested File owns file identity; VideoNote itself has no standalone row identity.
Rejected:
- table: The selected embedded decision stores this shape through LinkPreviewType.video_note, MessageContent.video_note, PushMessageContent.video_note; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: videoNote(duration:int32, waveform:bytes, length:int32, minithumbnail:minithumbnail, thumbnail:thumbnail, speech_recognition_result:SpeechRecognitionResult, video:file)
- update use: updateActiveLiveLocationMessages via LinkPreviewType/MessageContent; updateActiveNotifications via LinkPreviewType/MessageContent/PushMessageContent; updateBusinessMessageEdited via LinkPreviewType/MessageContent; updateChatLastMessage via LinkPreviewType/MessageContent; updateChatReplyMarkup via LinkPreviewType/MessageContent; updateDirectMessagesChatTopic via LinkPreviewType/MessageContent; updateFileAddedToDownloads via LinkPreviewType/MessageContent; updateMessageContent via LinkPreviewType/MessageContent; updateMessageSendFailed via LinkPreviewType/MessageContent; updateMessageSendSucceeded via LinkPreviewType/MessageContent; updateNewBusinessCallbackQuery via LinkPreviewType/MessageContent; updateNewBusinessMessage via LinkPreviewType/MessageContent; updateNewChat via LinkPreviewType/MessageContent; updateNewGuestQuery via LinkPreviewType/MessageContent; updateNewMessage via LinkPreviewType/MessageContent; updateNotification via LinkPreviewType/MessageContent/PushMessageContent; updateNotificationGroup via LinkPreviewType/MessageContent/PushMessageContent; updatePoll via LinkPreviewType/MessageContent; updateQuickReplyShortcut via LinkPreviewType/MessageContent; updateQuickReplyShortcutMessages via LinkPreviewType/MessageContent; updateSavedMessagesTopic via LinkPreviewType/MessageContent; updateServiceNotification via LinkPreviewType/MessageContent
- type use: LinkPreviewType.video_note; MessageContent.video_note; PushMessageContent.video_note; businessMessage via LinkPreviewType/MessageContent; businessMessages via LinkPreviewType/MessageContent; chat via LinkPreviewType/MessageContent; chatEvent via LinkPreviewType/MessageContent; chatEventMessageDeleted via LinkPreviewType/MessageContent; chatEventMessageEdited via LinkPreviewType/MessageContent; chatEventMessagePinned via LinkPreviewType/MessageContent; chatEventMessageUnpinned via LinkPreviewType/MessageContent; chatEventPollStopped via LinkPreviewType/MessageContent; chatEvents via LinkPreviewType/MessageContent; directMessagesChatTopic via LinkPreviewType/MessageContent; fileDownload via LinkPreviewType/MessageContent; forumTopic via LinkPreviewType/MessageContent; forumTopics via LinkPreviewType/MessageContent; foundChatMessages via LinkPreviewType/MessageContent; foundFileDownloads via LinkPreviewType/MessageContent; foundMessages via LinkPreviewType/MessageContent; foundPublicPosts via LinkPreviewType/MessageContent; linkPreview via LinkPreviewType; message via LinkPreviewType/MessageContent; messageCalendar via LinkPreviewType/MessageContent; messageCalendarDay via LinkPreviewType/MessageContent; messageLinkInfo via LinkPreviewType/MessageContent; messagePoll via LinkPreviewType/MessageContent; plus 22 more schema references
- procedures: addLocalMessage via LinkPreviewType/MessageContent; addOffer via LinkPreviewType/MessageContent; addQuickReplyShortcutInlineQueryResultMessage via LinkPreviewType/MessageContent; addQuickReplyShortcutMessage via LinkPreviewType/MessageContent; addQuickReplyShortcutMessageAlbum via LinkPreviewType/MessageContent; createBasicGroupChat via LinkPreviewType/MessageContent; createNewSecretChat via LinkPreviewType/MessageContent; createNewSupergroupChat via LinkPreviewType/MessageContent; createPrivateChat via LinkPreviewType/MessageContent; createSecretChat via LinkPreviewType/MessageContent; createSupergroupChat via LinkPreviewType/MessageContent; editBusinessMessageCaption via LinkPreviewType/MessageContent; editBusinessMessageChecklist via LinkPreviewType/MessageContent; editBusinessMessageLiveLocation via LinkPreviewType/MessageContent; editBusinessMessageMedia via LinkPreviewType/MessageContent; editBusinessMessageReplyMarkup via LinkPreviewType/MessageContent; editBusinessMessageText via LinkPreviewType/MessageContent; editMessageCaption via LinkPreviewType/MessageContent; editMessageChecklist via LinkPreviewType/MessageContent; editMessageLiveLocation via LinkPreviewType/MessageContent; editMessageMedia via LinkPreviewType/MessageContent; editMessageReplyMarkup via LinkPreviewType/MessageContent; editMessageText via LinkPreviewType/MessageContent; forwardMessages via LinkPreviewType/MessageContent; getCallbackQueryMessage via LinkPreviewType/MessageContent; getChat via LinkPreviewType/MessageContent; getChatEventLog via LinkPreviewType/MessageContent; getChatHistory via LinkPreviewType/MessageContent; getChatMessageByDate via LinkPreviewType/MessageContent; getChatMessageCalendar via LinkPreviewType/MessageContent; getChatPinnedMessage via LinkPreviewType/MessageContent; getChatScheduledMessages via LinkPreviewType/MessageContent; getChatSponsoredMessages via LinkPreviewType/MessageContent; getChatStoryInteractions via LinkPreviewType/MessageContent; getDirectMessagesChatTopic via LinkPreviewType/MessageContent; getDirectMessagesChatTopicHistory via LinkPreviewType/MessageContent; plus 43 more schema references
```

### VideoStoryboard

```text
Type: VideoStoryboard
Storage: embedded
Storage target: MessageContent.storyboards
Decision: This is storyboard metadata for a video message content value. The nested files own file identity; VideoStoryboard has no lifecycle outside MessageContent.storyboards.
Rejected:
- table: The selected embedded decision stores this shape through MessageContent.storyboards; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: videoStoryboard(storyboard_file:file, width:int32, height:int32, map_file:file)
- update use: updateActiveLiveLocationMessages via MessageContent; updateActiveNotifications via MessageContent; updateBusinessMessageEdited via MessageContent; updateChatLastMessage via MessageContent; updateChatReplyMarkup via MessageContent; updateDirectMessagesChatTopic via MessageContent; updateFileAddedToDownloads via MessageContent; updateMessageContent via MessageContent; updateMessageSendFailed via MessageContent; updateMessageSendSucceeded via MessageContent; updateNewBusinessCallbackQuery via MessageContent; updateNewBusinessMessage via MessageContent; updateNewChat via MessageContent; updateNewGuestQuery via MessageContent; updateNewMessage via MessageContent; updateNotification via MessageContent; updateNotificationGroup via MessageContent; updatePoll via MessageContent; updateQuickReplyShortcut via MessageContent; updateQuickReplyShortcutMessages via MessageContent; updateSavedMessagesTopic via MessageContent; updateServiceNotification via MessageContent
- type use: MessageContent.storyboards; businessMessage via MessageContent; businessMessages via MessageContent; chat via MessageContent; chatEvent via MessageContent; chatEventMessageDeleted via MessageContent; chatEventMessageEdited via MessageContent; chatEventMessagePinned via MessageContent; chatEventMessageUnpinned via MessageContent; chatEventPollStopped via MessageContent; chatEvents via MessageContent; directMessagesChatTopic via MessageContent; fileDownload via MessageContent; forumTopic via MessageContent; forumTopics via MessageContent; foundChatMessages via MessageContent; foundFileDownloads via MessageContent; foundMessages via MessageContent; foundPublicPosts via MessageContent; message via MessageContent; messageCalendar via MessageContent; messageCalendarDay via MessageContent; messageLinkInfo via MessageContent; messagePoll via MessageContent; messageReplyToMessage via MessageContent; plus 19 more schema references
- procedures: addLocalMessage via MessageContent; addOffer via MessageContent; addQuickReplyShortcutInlineQueryResultMessage via MessageContent; addQuickReplyShortcutMessage via MessageContent; addQuickReplyShortcutMessageAlbum via MessageContent; createBasicGroupChat via MessageContent; createNewSecretChat via MessageContent; createNewSupergroupChat via MessageContent; createPrivateChat via MessageContent; createSecretChat via MessageContent; createSupergroupChat via MessageContent; editBusinessMessageCaption via MessageContent; editBusinessMessageChecklist via MessageContent; editBusinessMessageLiveLocation via MessageContent; editBusinessMessageMedia via MessageContent; editBusinessMessageReplyMarkup via MessageContent; editBusinessMessageText via MessageContent; editMessageCaption via MessageContent; editMessageChecklist via MessageContent; editMessageLiveLocation via MessageContent; editMessageMedia via MessageContent; editMessageReplyMarkup via MessageContent; editMessageText via MessageContent; forwardMessages via MessageContent; getCallbackQueryMessage via MessageContent; getChat via MessageContent; getChatEventLog via MessageContent; getChatHistory via MessageContent; getChatMessageByDate via MessageContent; getChatMessageCalendar via MessageContent; getChatPinnedMessage via MessageContent; getChatScheduledMessages via MessageContent; getChatSponsoredMessages via MessageContent; getChatStoryInteractions via MessageContent; getDirectMessagesChatTopic via MessageContent; getDirectMessagesChatTopicHistory via MessageContent; plus 42 more schema references
```

### VoiceNote

```text
Type: VoiceNote
Storage: embedded
Storage target: InlineQueryResult.voice_note, LinkPreviewType.voice_note, MessageContent.voice_note, PageBlock.voice_note, PushMessageContent.voice_note
Decision: This is voice-note media metadata embedded under inline, link-preview, message, page-block, and push-content owners. The nested File owns file identity; VoiceNote itself has no standalone row identity.
Rejected:
- table: The selected embedded decision stores this shape through InlineQueryResult.voice_note, LinkPreviewType.voice_note, MessageContent.voice_note, PageBlock.voice_note, PushMessageContent.voice_note; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: voiceNote(duration:int32, waveform:bytes, mime_type:string, speech_recognition_result:SpeechRecognitionResult, voice:file)
- update use: updateActiveLiveLocationMessages via LinkPreviewType/MessageContent; updateActiveNotifications via LinkPreviewType/MessageContent/PushMessageContent; updateBusinessMessageEdited via LinkPreviewType/MessageContent; updateChatLastMessage via LinkPreviewType/MessageContent; updateChatReplyMarkup via LinkPreviewType/MessageContent; updateDirectMessagesChatTopic via LinkPreviewType/MessageContent; updateFileAddedToDownloads via LinkPreviewType/MessageContent; updateMessageContent via LinkPreviewType/MessageContent; updateMessageSendFailed via LinkPreviewType/MessageContent; updateMessageSendSucceeded via LinkPreviewType/MessageContent; updateNewBusinessCallbackQuery via LinkPreviewType/MessageContent; updateNewBusinessMessage via LinkPreviewType/MessageContent; updateNewChat via LinkPreviewType/MessageContent; updateNewGuestQuery via LinkPreviewType/MessageContent; updateNewMessage via LinkPreviewType/MessageContent; updateNotification via LinkPreviewType/MessageContent/PushMessageContent; updateNotificationGroup via LinkPreviewType/MessageContent/PushMessageContent; updatePoll via LinkPreviewType/MessageContent; updateQuickReplyShortcut via LinkPreviewType/MessageContent; updateQuickReplyShortcutMessages via LinkPreviewType/MessageContent; updateSavedMessagesTopic via LinkPreviewType/MessageContent; updateServiceNotification via LinkPreviewType/MessageContent
- type use: InlineQueryResult.voice_note; LinkPreviewType.voice_note; MessageContent.voice_note; PageBlock.voice_note; PushMessageContent.voice_note; businessMessage via LinkPreviewType/MessageContent; businessMessages via LinkPreviewType/MessageContent; chat via LinkPreviewType/MessageContent; chatEvent via LinkPreviewType/MessageContent; chatEventMessageDeleted via LinkPreviewType/MessageContent; chatEventMessageEdited via LinkPreviewType/MessageContent; chatEventMessagePinned via LinkPreviewType/MessageContent; chatEventMessageUnpinned via LinkPreviewType/MessageContent; chatEventPollStopped via LinkPreviewType/MessageContent; chatEvents via LinkPreviewType/MessageContent; directMessagesChatTopic via LinkPreviewType/MessageContent; fileDownload via LinkPreviewType/MessageContent; forumTopic via LinkPreviewType/MessageContent; forumTopics via LinkPreviewType/MessageContent; foundChatMessages via LinkPreviewType/MessageContent; foundFileDownloads via LinkPreviewType/MessageContent; foundMessages via LinkPreviewType/MessageContent; foundPublicPosts via LinkPreviewType/MessageContent; inlineQueryResults via InlineQueryResult; linkPreview via LinkPreviewType; message via LinkPreviewType/MessageContent; messageCalendar via LinkPreviewType/MessageContent; messageCalendarDay via LinkPreviewType/MessageContent; messageLinkInfo via LinkPreviewType/MessageContent; plus 32 more schema references
- procedures: addLocalMessage via LinkPreviewType/MessageContent; addOffer via LinkPreviewType/MessageContent; addQuickReplyShortcutInlineQueryResultMessage via LinkPreviewType/MessageContent; addQuickReplyShortcutMessage via LinkPreviewType/MessageContent; addQuickReplyShortcutMessageAlbum via LinkPreviewType/MessageContent; createBasicGroupChat via LinkPreviewType/MessageContent; createNewSecretChat via LinkPreviewType/MessageContent; createNewSupergroupChat via LinkPreviewType/MessageContent; createPrivateChat via LinkPreviewType/MessageContent; createSecretChat via LinkPreviewType/MessageContent; createSupergroupChat via LinkPreviewType/MessageContent; editBusinessMessageCaption via LinkPreviewType/MessageContent; editBusinessMessageChecklist via LinkPreviewType/MessageContent; editBusinessMessageLiveLocation via LinkPreviewType/MessageContent; editBusinessMessageMedia via LinkPreviewType/MessageContent; editBusinessMessageReplyMarkup via LinkPreviewType/MessageContent; editBusinessMessageText via LinkPreviewType/MessageContent; editMessageCaption via LinkPreviewType/MessageContent; editMessageChecklist via LinkPreviewType/MessageContent; editMessageLiveLocation via LinkPreviewType/MessageContent; editMessageMedia via LinkPreviewType/MessageContent; editMessageReplyMarkup via LinkPreviewType/MessageContent; editMessageText via LinkPreviewType/MessageContent; forwardMessages via LinkPreviewType/MessageContent; getCallbackQueryMessage via LinkPreviewType/MessageContent; getChat via LinkPreviewType/MessageContent; getChatEventLog via LinkPreviewType/MessageContent; getChatHistory via LinkPreviewType/MessageContent; getChatMessageByDate via LinkPreviewType/MessageContent; getChatMessageCalendar via LinkPreviewType/MessageContent; getChatPinnedMessage via LinkPreviewType/MessageContent; getChatScheduledMessages via LinkPreviewType/MessageContent; getChatSponsoredMessages via LinkPreviewType/MessageContent; getChatStoryInteractions via LinkPreviewType/MessageContent; getDirectMessagesChatTopic via LinkPreviewType/MessageContent; getDirectMessagesChatTopicHistory via LinkPreviewType/MessageContent; plus 46 more schema references
```

### WebApp

```text
Type: WebApp
Storage: embedded
Storage target: BotWriteAccessAllowReason.web_app, FoundWebApp.web_app
Decision: This is web-app metadata embedded in bot write-access reason and found-web-app results. It has no standalone row identity.
Rejected:
- table: The selected embedded decision stores this shape through BotWriteAccessAllowReason.web_app, FoundWebApp.web_app; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: webApp(short_name:string, title:string, description:string, photo:photo, animation:animation)
- update use: updateActiveLiveLocationMessages via BotWriteAccessAllowReason; updateActiveNotifications via BotWriteAccessAllowReason; updateBusinessMessageEdited via BotWriteAccessAllowReason; updateChatLastMessage via BotWriteAccessAllowReason; updateChatReplyMarkup via BotWriteAccessAllowReason; updateDirectMessagesChatTopic via BotWriteAccessAllowReason; updateFileAddedToDownloads via BotWriteAccessAllowReason; updateMessageContent via BotWriteAccessAllowReason; updateMessageSendFailed via BotWriteAccessAllowReason; updateMessageSendSucceeded via BotWriteAccessAllowReason; updateNewBusinessCallbackQuery via BotWriteAccessAllowReason; updateNewBusinessMessage via BotWriteAccessAllowReason; updateNewChat via BotWriteAccessAllowReason; updateNewGuestQuery via BotWriteAccessAllowReason; updateNewMessage via BotWriteAccessAllowReason; updateNotification via BotWriteAccessAllowReason; updateNotificationGroup via BotWriteAccessAllowReason; updatePoll via BotWriteAccessAllowReason; updateQuickReplyShortcut via BotWriteAccessAllowReason; updateQuickReplyShortcutMessages via BotWriteAccessAllowReason; updateSavedMessagesTopic via BotWriteAccessAllowReason; updateServiceNotification via BotWriteAccessAllowReason
- type use: BotWriteAccessAllowReason.web_app; FoundWebApp.web_app; businessMessage via BotWriteAccessAllowReason; businessMessages via BotWriteAccessAllowReason; chat via BotWriteAccessAllowReason; chatEvent via BotWriteAccessAllowReason; chatEventMessageDeleted via BotWriteAccessAllowReason; chatEventMessageEdited via BotWriteAccessAllowReason; chatEventMessagePinned via BotWriteAccessAllowReason; chatEventMessageUnpinned via BotWriteAccessAllowReason; chatEventPollStopped via BotWriteAccessAllowReason; chatEvents via BotWriteAccessAllowReason; directMessagesChatTopic via BotWriteAccessAllowReason; fileDownload via BotWriteAccessAllowReason; forumTopic via BotWriteAccessAllowReason; forumTopics via BotWriteAccessAllowReason; foundChatMessages via BotWriteAccessAllowReason; foundFileDownloads via BotWriteAccessAllowReason; foundMessages via BotWriteAccessAllowReason; foundPublicPosts via BotWriteAccessAllowReason; message via BotWriteAccessAllowReason; messageBotWriteAccessAllowed via BotWriteAccessAllowReason; messageCalendar via BotWriteAccessAllowReason; messageCalendarDay via BotWriteAccessAllowReason; messageLinkInfo via BotWriteAccessAllowReason; messagePoll via BotWriteAccessAllowReason; plus 20 more schema references
- procedures: addLocalMessage via BotWriteAccessAllowReason; addOffer via BotWriteAccessAllowReason; addQuickReplyShortcutInlineQueryResultMessage via BotWriteAccessAllowReason; addQuickReplyShortcutMessage via BotWriteAccessAllowReason; addQuickReplyShortcutMessageAlbum via BotWriteAccessAllowReason; createBasicGroupChat via BotWriteAccessAllowReason; createNewSecretChat via BotWriteAccessAllowReason; createNewSupergroupChat via BotWriteAccessAllowReason; createPrivateChat via BotWriteAccessAllowReason; createSecretChat via BotWriteAccessAllowReason; createSupergroupChat via BotWriteAccessAllowReason; editBusinessMessageCaption via BotWriteAccessAllowReason; editBusinessMessageChecklist via BotWriteAccessAllowReason; editBusinessMessageLiveLocation via BotWriteAccessAllowReason; editBusinessMessageMedia via BotWriteAccessAllowReason; editBusinessMessageReplyMarkup via BotWriteAccessAllowReason; editBusinessMessageText via BotWriteAccessAllowReason; editMessageCaption via BotWriteAccessAllowReason; editMessageChecklist via BotWriteAccessAllowReason; editMessageLiveLocation via BotWriteAccessAllowReason; editMessageMedia via BotWriteAccessAllowReason; editMessageReplyMarkup via BotWriteAccessAllowReason; editMessageText via BotWriteAccessAllowReason; forwardMessages via BotWriteAccessAllowReason; getCallbackQueryMessage via BotWriteAccessAllowReason; getChat via BotWriteAccessAllowReason; getChatEventLog via BotWriteAccessAllowReason; getChatHistory via BotWriteAccessAllowReason; getChatMessageByDate via BotWriteAccessAllowReason; getChatMessageCalendar via BotWriteAccessAllowReason; getChatPinnedMessage via BotWriteAccessAllowReason; getChatScheduledMessages via BotWriteAccessAllowReason; getChatSponsoredMessages via BotWriteAccessAllowReason; getChatStoryInteractions via BotWriteAccessAllowReason; getDirectMessagesChatTopic via BotWriteAccessAllowReason; getDirectMessagesChatTopicHistory via BotWriteAccessAllowReason; plus 43 more schema references
```

### WebAppOpenMode

```text
Type: WebAppOpenMode
Storage: embedded
Storage target: InternalLinkType.mode, MainWebApp.mode, WebAppOpenParameters.mode
Decision: This is an enum-like display mode stored in internal-link, main web-app, and web-app open-parameter payloads. It has no standalone lifecycle.
Rejected:
- table: The selected embedded decision stores this shape through InternalLinkType.mode, MainWebApp.mode, WebAppOpenParameters.mode; it does not require its own independently addressed table row.
- extend: The selected embedded decision is not a one-to-one structural extension of a single owner row.
- facet: The selected embedded decision is not a separate owner-scoped aspect keyed only by an external owner id.
- pair: The selected embedded decision is not stored only as a key/value association between two TDLib types.
- kv: The selected embedded decision is not a singleton account/global value keyed only by a stable domain name.
- event: The selected embedded decision represents current state or payload that storage must retain when the owner is retained.
Evidence:
- constructors: webAppOpenModeCompact(); webAppOpenModeFullScreen(); webAppOpenModeFullSize()
- update use: updateActiveLiveLocationMessages via InternalLinkType; updateActiveNotifications via InternalLinkType; updateBusinessMessageEdited via InternalLinkType; updateChatLastMessage via InternalLinkType; updateChatReplyMarkup via InternalLinkType; updateDirectMessagesChatTopic via InternalLinkType; updateFileAddedToDownloads via InternalLinkType; updateMessageEdited via InternalLinkType; updateMessageSendFailed via InternalLinkType; updateMessageSendSucceeded via InternalLinkType; updateNewBusinessCallbackQuery via InternalLinkType; updateNewBusinessMessage via InternalLinkType; updateNewChat via InternalLinkType; updateNewGuestQuery via InternalLinkType; updateNewMessage via InternalLinkType; updateNotification via InternalLinkType; updateNotificationGroup via InternalLinkType; updateQuickReplyShortcut via InternalLinkType; updateQuickReplyShortcutMessages via InternalLinkType; updateSavedMessagesTopic via InternalLinkType; updateUserFullInfo via InternalLinkType
- type use: InternalLinkType.mode; MainWebApp.mode; WebAppOpenParameters.mode; botInfo via InternalLinkType; businessMessage via InternalLinkType; businessMessages via InternalLinkType; chat via InternalLinkType; chatEvent via InternalLinkType; chatEventMessageDeleted via InternalLinkType; chatEventMessageEdited via InternalLinkType; chatEventMessagePinned via InternalLinkType; chatEventMessageUnpinned via InternalLinkType; chatEventPollStopped via InternalLinkType; chatEvents via InternalLinkType; directMessagesChatTopic via InternalLinkType; fileDownload via InternalLinkType; forumTopic via InternalLinkType; forumTopics via InternalLinkType; foundChatMessages via InternalLinkType; foundFileDownloads via InternalLinkType; foundMessages via InternalLinkType; foundPublicPosts via InternalLinkType; inlineKeyboardButton via InternalLinkType; inlineKeyboardButtonTypeSwitchInline via InternalLinkType; inputInlineQueryResultAnimation via InternalLinkType; inputInlineQueryResultArticle via InternalLinkType; inputInlineQueryResultAudio via InternalLinkType; plus 36 more schema references
- procedures: addLocalMessage via InternalLinkType; addOffer via InternalLinkType; addQuickReplyShortcutInlineQueryResultMessage via InternalLinkType; addQuickReplyShortcutMessage via InternalLinkType; addQuickReplyShortcutMessageAlbum via InternalLinkType; answerGuestQuery via InternalLinkType; answerInlineQuery via InternalLinkType; answerWebAppQuery via InternalLinkType; createBasicGroupChat via InternalLinkType; createNewSecretChat via InternalLinkType; createNewSupergroupChat via InternalLinkType; createPrivateChat via InternalLinkType; createSecretChat via InternalLinkType; createSupergroupChat via InternalLinkType; editBusinessMessageCaption via InternalLinkType; editBusinessMessageChecklist via InternalLinkType; editBusinessMessageLiveLocation via InternalLinkType; editBusinessMessageMedia via InternalLinkType; editBusinessMessageReplyMarkup via InternalLinkType; editBusinessMessageText via InternalLinkType; editInlineMessageCaption via InternalLinkType; editInlineMessageLiveLocation via InternalLinkType; editInlineMessageMedia via InternalLinkType; editInlineMessageReplyMarkup via InternalLinkType; editInlineMessageText via InternalLinkType; editMessageCaption via InternalLinkType; editMessageChecklist via InternalLinkType; editMessageLiveLocation via InternalLinkType; editMessageMedia via InternalLinkType; editMessageReplyMarkup via InternalLinkType; editMessageText via InternalLinkType; forwardMessages via InternalLinkType; getCallbackQueryMessage via InternalLinkType; getChat via InternalLinkType; getChatEventLog via InternalLinkType; getChatHistory via InternalLinkType; plus 61 more schema references
```

## Batch Review

All 83 remaining S through W types were completed without introducing a new storage kind.
