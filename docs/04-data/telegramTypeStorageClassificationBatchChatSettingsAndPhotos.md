# Telegram Type Storage Classification Batch: Chat Settings And Photos

Input types:

```text
ChatNotificationSettings
ChatPermissions
ChatPhoto
ChatPhotoInfo
ChatPhotoSticker
ChatPhotoStickerType
```

Source evidence:

- `packages/telegram/src/tdlib-docs/data/tdlibSchema.json`
- `packages/telegram/src/tdlib-docs/data/tdlibStorageReview.json`

Spreadsheet updates: none.

## Shared Evidence

The photo-related types have a large indirect fan-out through `Message`,
`MessageContent`, `LinkPreview`, notifications, downloads, quick replies, and
search results. The storage decision below does not treat every fan-out owner as
a storage target; the target is the nearest persisted domain type that owns the
field.

Photo fan-out updates:

```text
updateActiveLiveLocationMessages
updateActiveNotifications
updateBasicGroupFullInfo
updateBusinessMessageEdited
updateChatLastMessage
updateChatReplyMarkup
updateDirectMessagesChatTopic
updateFileAddedToDownloads
updateMessageContent
updateMessageSendFailed
updateMessageSendSucceeded
updateNewBusinessCallbackQuery
updateNewBusinessMessage
updateNewChat
updateNewGuestQuery
updateNewMessage
updateNotification
updateNotificationGroup
updatePoll
updateQuickReplyShortcut
updateQuickReplyShortcutMessages
updateSavedMessagesTopic
updateServiceNotification
updateSupergroupFullInfo
updateUserFullInfo
```

Photo fan-out return procedures:

```text
addLocalMessage
addOffer
addQuickReplyShortcutInlineQueryResultMessage
addQuickReplyShortcutMessage
addQuickReplyShortcutMessageAlbum
createBasicGroupChat
createNewSecretChat
createNewSupergroupChat
createPrivateChat
createSecretChat
createSupergroupChat
editBusinessMessageCaption
editBusinessMessageChecklist
editBusinessMessageLiveLocation
editBusinessMessageMedia
editBusinessMessageReplyMarkup
editBusinessMessageText
editMessageCaption
editMessageChecklist
editMessageLiveLocation
editMessageMedia
editMessageReplyMarkup
editMessageText
forwardMessages
getBasicGroupFullInfo
getCallbackQueryMessage
getChat
getChatEventLog
getChatHistory
getChatMessageByDate
getChatMessageCalendar
getChatPinnedMessage
getChatScheduledMessages
getChatSponsoredMessages
getChatStoryInteractions
getDirectMessagesChatTopic
getDirectMessagesChatTopicHistory
getDirectMessagesChatTopicMessageByDate
getForumTopic
getForumTopicHistory
getForumTopics
getLinkPreview
getMessage
getMessageLinkInfo
getMessageLocally
getMessagePublicForwards
getMessageThread
getMessageThreadHistory
getMessages
getPersonalChatHistory
getRepliedMessage
getSavedMessagesTopicHistory
getSavedMessagesTopicMessageByDate
getStoryInteractions
getStoryPublicForwards
getSupergroupFullInfo
getUserFullInfo
getUserProfilePhotos
joinChatByInviteLink
readdQuickReplyShortcutMessages
resendMessages
searchCallMessages
searchChatAffiliateProgram
searchChatMessages
searchChatRecentLocationMessages
searchFileDownloads
searchMessages
searchOutgoingDocumentMessages
searchPublicChat
searchPublicMessagesByTag
searchPublicPosts
searchSavedMessages
searchSecretMessages
sendBotStartMessage
sendBusinessMessage
sendBusinessMessageAlbum
sendInlineQueryResultMessage
sendMessage
sendMessageAlbum
sendQuickReplyShortcutMessages
setGameScore
stopBusinessPoll
upgradeBasicGroupChatToSupergroupChat
```

## Decisions

### ChatNotificationSettings

```text
Type: ChatNotificationSettings
Storage: embedded
Storage target: Chat.notification_settings, ForumTopic.notification_settings
Decision: This is a value object for notification settings of either a chat or a forum topic. It has no own identity; updates and procedures always provide the owner separately.
Rejected:
- table: no stable row identity inside the type; chat/topic identity is external.
- extend: this does not extend the full owner row; it is one field on the owner.
- facet: the current source shape is direct owner-field replacement, not a separate owner aspect with its own record shape.
- pair: there is no separate key/value companion type.
- kv: the value belongs to Chat or ForumTopic, not account/global scope.
- event: this is durable current state and must survive restart.
Evidence:
- constructors: chatNotificationSettings(use_default_mute_for, mute_for, use_default_sound, sound_id, use_default_show_preview, show_preview, use_default_mute_stories, mute_stories, use_default_story_sound, story_sound_id, use_default_show_story_poster, show_story_poster, use_default_disable_pinned_message_notifications, disable_pinned_message_notifications, use_default_disable_mention_notifications, disable_mention_notifications).
- update use: direct in updateChatNotificationSettings.notification_settings and updateForumTopic.notification_settings; indirect in updateNewChat.chat -> Chat.notification_settings.
- type use: direct in Chat.notification_settings and ForumTopic.notification_settings; indirect in ForumTopics.topics -> ForumTopic.notification_settings.
- procedures: setChatNotificationSettings accepts notification_settings; setForumTopicNotificationSettings accepts notification_settings; createBasicGroupChat, createNewSecretChat, createNewSupergroupChat, createPrivateChat, createSecretChat, createSupergroupChat, getChat, joinChatByInviteLink, searchChatAffiliateProgram, searchPublicChat, upgradeBasicGroupChatToSupergroupChat return Chat with Chat.notification_settings; getForumTopic and getForumTopics return ForumTopic with ForumTopic.notification_settings.
```

### ChatPermissions

```text
Type: ChatPermissions
Storage: embedded
Storage target: Chat.permissions, ChatMemberStatus.permissions, ChatEventAction.old_permissions, ChatEventAction.new_permissions
Decision: This is a permission value object. It can be a chat default permission set, a restricted member permission set, or an audit-log before/after value.
Rejected:
- table: no own id and no procedure addresses a ChatPermissions row.
- extend: it does not structurally extend Chat, ChatMemberStatus, or ChatEventAction; it is a nested value field.
- facet: owner keys belong to Chat, ChatMember, or audit event structures; ChatPermissions itself is not the owner aspect record.
- pair: there is no separate key/value companion type.
- kv: the value belongs to concrete chat/member/event owners, not account/global scope.
- event: permissions are persistent state inside Chat and ChatMemberStatus; audit-event copies are historical payload values.
Evidence:
- constructors: chatPermissions(can_send_basic_messages, can_send_audios, can_send_documents, can_send_photos, can_send_videos, can_send_video_notes, can_send_voice_notes, can_send_polls, can_send_other_messages, can_add_link_previews, can_react_to_messages, can_edit_tag, can_change_info, can_invite_users, can_pin_messages, can_create_topics).
- update use: direct in updateChatPermissions.permissions; indirect in updateNewChat.chat -> Chat.permissions, updateBasicGroup.basic_group -> BasicGroup.status -> ChatMemberStatus.permissions, updateSupergroup.supergroup -> Supergroup.status -> ChatMemberStatus.permissions, updateBasicGroupFullInfo.basic_group_full_info -> BasicGroupFullInfo.members -> ChatMember.status -> ChatMemberStatus.permissions, updateChatMember.old_chat_member/new_chat_member -> ChatMember.status -> ChatMemberStatus.permissions.
- type use: direct in Chat.permissions, ChatMemberStatus.permissions, ChatEventAction.old_permissions, ChatEventAction.new_permissions; indirect through BasicGroup.status, Supergroup.status, ChatMember.status, BasicGroupFullInfo.members, ChatEvents.events.
- procedures: setChatPermissions accepts permissions; setChatMemberStatus accepts status with ChatMemberStatus.permissions; getChat and chat creation/search/join procedures return Chat with Chat.permissions; getBasicGroup, getSupergroup, getChatMember, getBasicGroupFullInfo, getSupergroupMembers, searchChatMembers return owner/member structures containing ChatMemberStatus.permissions; getChatEventLog returns ChatEventAction old/new permissions and member status permissions.
```

### ChatPhoto

```text
Type: ChatPhoto
Storage: table
Storage target: id
Decision: This is a durable profile/chat photo object with its own unique photo id. It is returned in profile photo lists, can be reused by id through inputChatPhotoPrevious, and can be deleted by id through deleteProfilePhoto.
Rejected:
- embedded: embedding would duplicate the same photo across UserFullInfo, BasicGroupFullInfo, SupergroupFullInfo, ChatPhotos, MessageContent, and LinkPreviewType while the type has its own id.
- extend: it does not extend one owner row; the same photo can appear under user, chat, message, event, link preview, and profile-photo-list contexts.
- facet: the key is the photo id itself, not an owner id such as User.id or Chat.id.
- pair: there is no key/value companion type.
- kv: this is not account/global singleton or catalog state.
- event: profile photos and chat photos are durable cache state and are also referenced by procedures.
Evidence:
- constructors: chatPhoto(id, added_date, minithumbnail, sizes, animation, small_animation, sticker).
- update use: no direct root field; indirect in the shared photo fan-out updates, with direct owner paths in updateBasicGroupFullInfo.basic_group_full_info -> BasicGroupFullInfo.photo, updateSupergroupFullInfo.supergroup_full_info -> SupergroupFullInfo.photo, updateUserFullInfo.user_full_info -> UserFullInfo.personal_photo/photo/public_photo, updateMessageContent.new_content -> MessageContent.photo, and message/link-preview fan-out paths.
- type use: direct in BasicGroupFullInfo.photo, SupergroupFullInfo.photo, UserFullInfo.personal_photo, UserFullInfo.photo, UserFullInfo.public_photo, ChatPhotos.photos, MessageContent.photo, ChatEventAction.old_photo, ChatEventAction.new_photo, LinkPreviewType.photo; indirect through Message, BusinessMessage, Chat.last_message, ForumTopic.last_message, notifications, downloads, quick replies, search result containers, and story/public forward containers.
- procedures: deleteProfilePhoto deletes by profile_photo_id; inputChatPhotoPrevious refers to chat_photo_id; getUserProfilePhotos returns ChatPhotos.photos; getBasicGroupFullInfo, getSupergroupFullInfo, getUserFullInfo return direct owner photo fields; shared photo fan-out return procedures return Message, Chat, LinkPreview, ChatEvents, and other containers with ChatPhoto paths; setProfilePhoto, setChatPhoto, setBotProfilePhoto, setBusinessAccountProfilePhoto, setUserPersonalProfilePhoto, suggestUserProfilePhoto accept InputChatPhoto and can create or reuse profile/chat photos.
```

### ChatPhotoInfo

```text
Type: ChatPhotoInfo
Storage: embedded
Storage target: Chat.photo, ChatInviteLinkInfo.photo, PageBlock.photo
Decision: This is a lightweight current-photo preview value. It has no own id; the owner is the chat, invite-link info, or page block that contains it.
Rejected:
- table: no primary key exists in ChatPhotoInfo; nested File values have their own identity, but ChatPhotoInfo does not.
- extend: it is not a full-info extension of Chat or another owner; it is one field.
- facet: the owner-field replacement shape is direct embedded state, not a separate owner aspect record.
- pair: there is no key/value companion type.
- kv: the value belongs to specific owner objects, not account/global scope.
- event: chat photo info is current cache state.
Evidence:
- constructors: chatPhotoInfo(small, big, minithumbnail, has_animation, is_personal).
- update use: direct in updateChatPhoto.photo; indirect in updateNewChat.chat -> Chat.photo.
- type use: direct in Chat.photo, ChatInviteLinkInfo.photo, PageBlock.photo; indirect in nested PageBlock containers, PageBlockListItem.page_blocks, TMeUrlType.info -> ChatInviteLinkInfo.photo, TMeUrl/TMeUrls, and WebPageInstantView.page_blocks.
- procedures: checkChatInviteLink returns ChatInviteLinkInfo.photo; getWebPageInstantView returns PageBlock.photo paths; getRecentlyVisitedTMeUrls returns TMeUrlType.info -> ChatInviteLinkInfo.photo; createBasicGroupChat, createNewSecretChat, createNewSupergroupChat, createPrivateChat, createSecretChat, createSupergroupChat, getChat, joinChatByInviteLink, searchChatAffiliateProgram, searchPublicChat, upgradeBasicGroupChatToSupergroupChat return Chat.photo.
```

### ChatPhotoSticker

```text
Type: ChatPhotoSticker
Storage: embedded
Storage target: ChatPhoto.sticker
Decision: This is sticker metadata inside a stored ChatPhoto. Procedure input also uses it through InputChatPhoto.sticker, but procedure input is not local storage.
Rejected:
- table: no own id; the ids inside ChatPhotoStickerType identify the source sticker/custom emoji, not the ChatPhotoSticker value.
- extend: it does not extend ChatPhoto; it is one nested field.
- facet: there is no owner-keyed record separate from ChatPhoto.
- pair: there is no key/value companion type.
- kv: this is not account/global state.
- event: this is part of durable ChatPhoto state.
Evidence:
- constructors: chatPhotoSticker(type, background_fill).
- update use: no direct root field; indirect through ChatPhoto.sticker in the shared photo fan-out updates.
- type use: direct in ChatPhoto.sticker and InputChatPhoto.sticker; indirect through all ChatPhoto owner paths.
- procedures: setBotProfilePhoto, setBusinessAccountProfilePhoto, setChatPhoto, setProfilePhoto, setUserPersonalProfilePhoto, suggestUserProfilePhoto accept InputChatPhoto.sticker; shared photo fan-out return procedures return ChatPhoto.sticker through ChatPhoto paths.
```

### ChatPhotoStickerType

```text
Type: ChatPhotoStickerType
Storage: embedded
Storage target: ChatPhotoSticker.type
Decision: This is a discriminated source selector for ChatPhotoSticker. Its ids point to a sticker/custom emoji source, but the type itself has no row identity or independent lifecycle.
Rejected:
- table: sticker_set_id, sticker_id, and custom_emoji_id identify external source objects, not a ChatPhotoStickerType row.
- extend: it does not extend ChatPhotoSticker; it is the nested type field.
- facet: there is no owner key and no standalone aspect record.
- pair: there is no key/value companion type.
- kv: this is not account/global state.
- event: this is part of durable ChatPhoto.sticker state.
Evidence:
- constructors: chatPhotoStickerTypeRegularOrMask(sticker_set_id, sticker_id); chatPhotoStickerTypeCustomEmoji(custom_emoji_id).
- update use: no direct root field; indirect through ChatPhotoSticker.type -> ChatPhoto.sticker in the shared photo fan-out updates.
- type use: direct in ChatPhotoSticker.type; indirect through ChatPhoto.sticker, InputChatPhoto.sticker, and all ChatPhoto owner paths.
- procedures: setBotProfilePhoto, setBusinessAccountProfilePhoto, setChatPhoto, setProfilePhoto, setUserPersonalProfilePhoto, suggestUserProfilePhoto accept InputChatPhoto.sticker.type; shared photo fan-out return procedures return ChatPhoto.sticker.type through ChatPhoto paths.
```

## Batch Review

Completed all requested input types. No new storage kind is required.

Framework note from the pilot: the batch can legitimately reference owner types
outside the current input list when the source schema directly exposes the owner
field. The result must record those external owner targets explicitly instead
of blocking the batch only because the owner type is not part of the current
batch.
