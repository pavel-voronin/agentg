# Telegram Type Storage Classification Batch: F Types

## Input Types

1. FactCheck
2. File
3. FileDownload
4. FirebaseDeviceVerificationParameters
5. FormattedText
6. ForumTopicIcon
7. ForumTopicInfo
8. ForwardSource

## Shared Evidence

The batch follows `telegramTypeStorageClassification.md`. The persistent
storage decision is written to `tdlibStorageReview.json` as maturity 1 review
data using the `storage-decision` schema.

`File` is the only canonical entity in this batch with a standalone TDLib id.
`FileDownload` is deliberately kept separate from `File`: it is current
download-list state keyed by `File.id`, so it is a facet rather than the
canonical file table. `FormattedText` is a repeated value object; input-only and
fresh procedure-result uses are evidence, but they are not standalone storage
targets.

## Decisions

### FactCheck

```text
Type: FactCheck
Storage: embedded
Storage target: Message.fact_check
Decision: This is a nullable fact-check value owned by a message. updateMessageFactCheck addresses the message by chat_id and message_id and replaces Message.fact_check; FactCheck has no standalone identity.
Rejected:
- table: No fact-check id exists; chat_id/message_id identify the owning Message, not the FactCheck value.
- extend: It does not extend Message structurally; it is one nullable message field.
- facet: The write shape is owner-field replacement, not a separate owner-keyed record.
- pair: There is no key/value companion type.
- kv: Fact checks belong to concrete messages, not account/global state.
- event: A message fact check is durable message state.
Evidence:
- constructors: factCheck(text:formattedText, country_code:string)
- update use: direct updateMessageFactCheck.fact_check; indirect message update paths carrying Message.fact_check.
- type use: direct Message.fact_check; indirect Message and message owner containers expose FactCheck through Message.fact_check.
- procedures: setMessageFactCheck(chat_id, message_id, text) mutates Message.fact_check.
```

### File

```text
Type: File
Storage: table
Storage target: id
Decision: This is the canonical file entity keyed by file.id. updateFile and file procedures address and replace File rows independently; media owners should store references to this table row.
Rejected:
- embedded: File has a stable id and direct update/procedure lifecycle independent from each media owner.
- extend: It does not extend a single owner row; many owner fields reference the same file entity.
- facet: The id is the File identity itself, not just an owner key for an auxiliary aspect.
- pair: There is no key/value companion type.
- kv: Files are entity rows keyed by file id, not account/global singleton state.
- event: File state is durable and updated by updateFile.
Evidence:
- constructors: file(id:int32, size:int53, expected_size:int53, local:localFile, remote:remoteFile)
- update use: direct updateFile.file; indirect media/message/story/chat-photo owner updates carry File through media payload fields.
- type use: direct AlternativeVideo.hls_file/video, AnimatedChatPhoto.file, AnimatedEmoji.sound, Animation.animation, AttachmentMenuBot icons/placeholders, Audio.audio, ChatPhotoInfo.small/big, DatedFile.file, Document.document, NotificationSound.sound, PhotoSize.photo, ProfilePhoto.small/big, Sticker.sticker, StickerFullType.premium_animation, StoryVideo.video, Thumbnail.file, Video.video, VideoNote.video, VideoStoryboard.storyboard_file/map_file, VoiceNote.voice.
- procedures: addFileToDownloads, downloadFile, getFile, getMapThumbnailFile, getRemoteFile, preliminaryUploadFile, and uploadStickerFile return File; file download/delete procedures mutate file-related state by file_id.
```

### FileDownload

```text
Type: FileDownload
Storage: facet
Storage target: file_id = File.id
Decision: This is the download-list state for a File, keyed by file_id. Add/change/remove updates mutate the separate download aspect while the canonical File remains stored in File.
Rejected:
- table: The stable key is File.id; FileDownload is an auxiliary download aspect of that File rather than a separate entity identity.
- embedded: The update lifecycle adds, mutates, and removes the download row by file_id outside a File owner-field replacement.
- extend: It does not extend the File row structurally because the download list has its own search/list lifecycle and can be absent.
- pair: There is no separate key/value companion type; file_id is the owner key.
- kv: Download rows belong to concrete files, not account/global singleton state.
- event: Download list entries are current state exposed by searchFileDownloads and updateFileDownload.
Evidence:
- constructors: fileDownload(file_id:int32, message:message, add_date:int32, complete_date:int32, is_paused:Bool)
- update use: direct updateFileAddedToDownloads.file_download; updateFileDownload.file_id and updateFileRemovedFromDownloads.file_id mutate/remove the same row by File.id.
- type use: direct FoundFileDownloads.files.
- procedures: searchFileDownloads returns FoundFileDownloads.files; addFileToDownloads adds a row for File.id; toggleDownloadIsPaused mutates it; removeFileFromDownloads removes it.
```

### FirebaseDeviceVerificationParameters

```text
Type: FirebaseDeviceVerificationParameters
Storage: embedded
Storage target: AuthenticationCodeType.device_verification_parameters
Decision: This is a flow-local verification parameter value nested in authenticationCodeTypeFirebaseAndroid. It has no identity and no direct update or procedure lifecycle.
Rejected:
- table: No durable id exists; nonce values are payload for a verification flow.
- extend: It does not extend an account or authorization row; it is one field of AuthenticationCodeType.
- facet: No owner-keyed record is updated separately from the authentication code type value.
- pair: There is no key/value companion type.
- kv: The value is tied to a concrete authentication flow, not account/global cached state.
- event: The parameters are state needed while the auth flow is active, not a live-only event.
Evidence:
- constructors: firebaseDeviceVerificationParametersPlayIntegrity(nonce:string, cloud_project_number:int64); firebaseDeviceVerificationParametersSafetyNet(nonce:bytes)
- update use: no direct update use; indirect authorization/authentication state updates can expose it through AuthenticationCodeType.device_verification_parameters.
- type use: direct AuthenticationCodeType.device_verification_parameters; indirect AuthorizationState and authentication code containers containing AuthenticationCodeType.
- procedures: sendAuthenticationFirebaseSms and sendPhoneNumberFirebaseSms consume generated tokens, not FirebaseDeviceVerificationParameters directly.
```

### FormattedText

```text
Type: FormattedText
Storage: embedded
Storage target: BotVerification.custom_description, BotVerificationParameters.default_custom_description, BusinessChatLink.text, BusinessChatLinkInfo.text, CanSendGiftResult.reason, ChatFolderName.text, Checklist.title, ChecklistTask.text, DeepLinkInfo.text, FactCheck.text, FixedText.text, Game.text, GiftAuctionAcquiredGift.text, GroupCallMessage.text, ImportedContact.note, InternalLinkType.text, LinkPreview.description, MessageContent.text, MessageContent.caption, MessageContent.description, MessageContent.paid_media_caption, Poll.question, PollOption.text, PollType.explanation, PremiumState.state, ProductInfo.description, ReceivedGift.text, Story.caption, SuggestedAction.title, SuggestedAction.description, TermsOfService.text, TextCompositionStyleExample.source_text, TextCompositionStyleExample.result_text, TextQuote.text, UpgradedGiftOriginalDetails.text, UserFullInfo.bio, UserFullInfo.note, UserSupportInfo.message
Decision: This is a reusable formatted text value stored in each owning field. It has no stable text id; procedures either accept it as input, return fresh transformed text, or mutate a concrete owner field such as Message.fact_check.
Rejected:
- table: No stable FormattedText id exists; identical text can appear in many unrelated owner fields.
- extend: It does not extend a single owner row; it is a field value used by many owners.
- facet: There is no owner-keyed FormattedText record updated separately from the owning field.
- pair: Text and entities are one value object, not a key/value companion pair.
- kv: FormattedText belongs to concrete owners or fresh procedure results, not account/global singleton state.
- event: Formatted text appears in durable message, story, user, poll, checklist, and configuration state.
Evidence:
- constructors: formattedText(text:string, entities:vector<textEntity>)
- update use: direct updatePendingTextMessage.text; indirect message, story, chat folder, checklist, user full info, terms of service, fact-check, and text-composition updates carry FormattedText through owner fields.
- type use: direct BotVerification.custom_description, BotVerificationParameters.default_custom_description, BusinessChatLink.text, BusinessChatLinkInfo.text, CanSendGiftResult.reason, ChatFolderName.text, Checklist.title, ChecklistTask.text, DeepLinkInfo.text, FactCheck.text, FixedText.text, Game.text, GiftAuctionAcquiredGift.text, GroupCallMessage.text, ImportedContact.note, Input* formatted text fields, InternalLinkType.text, LinkPreview.description, MessageContent text/caption/description fields, MessageCopyOptions.new_caption, Poll/PollOption/PollType fields, PremiumState.state, ProductInfo.description, ReceivedGift.text, payment-purpose text fields, Story.caption, SuggestedAction title/description, TermsOfService.text, TextCompositionStyleExample source/result text, TextQuote.text, UpgradedGiftOriginalDetails.text, UserFullInfo.bio/note, UserSupportInfo.message.
- procedures: composeTextWithAi, getMarkdownText, parseMarkdown, parseTextEntities, translateText, translateMessageText, and summarizeMessage return FormattedText or owners containing it; edit/send/post/story/fact-check/user-note procedures accept it as owner-field input.
```

### ForumTopicIcon

```text
Type: ForumTopicIcon
Storage: embedded
Storage target: ForumTopicInfo.icon, MessageContent.icon
Decision: This is an icon value inside forum topic state or a service message. custom_emoji_id references emoji identity, but ForumTopicIcon itself has no row identity.
Rejected:
- table: No icon id exists; custom_emoji_id is a referenced emoji id, not the ForumTopicIcon row identity.
- extend: It does not extend ForumTopicInfo; it is one nested icon field.
- facet: No separate owner-keyed icon lifecycle exists outside ForumTopicInfo or message content.
- pair: There is no key/value companion type.
- kv: Forum topic icons belong to concrete topic/message owners, not account/global state.
- event: Forum topic icon state is persisted as topic info or message content.
Evidence:
- constructors: forumTopicIcon(color:int32, custom_emoji_id:int64)
- update use: indirect updateForumTopicInfo.info -> ForumTopicInfo.icon and message updates carrying messageForumTopicCreated.icon.
- type use: direct ForumTopicInfo.icon and MessageContent.icon; indirect ForumTopicInfo, ForumTopic, and forum-topic service messages.
- procedures: createForumTopic(chat_id, name, is_name_implicit, icon) accepts ForumTopicIcon and returns ForumTopicInfo.
```

### ForumTopicInfo

```text
Type: ForumTopicInfo
Storage: table
Storage target: chat_id = Chat.id, forum_topic_id
Decision: This is the addressable forum topic info row keyed by chat_id and forum_topic_id. updateForumTopicInfo replaces that row, and topic procedures get or mutate the same composite identity.
Rejected:
- embedded: ForumTopicInfo has its own composite identity and root update, not only a nested owner field.
- extend: It is not a one-per-Chat extension; many forum topics can exist per chat.
- facet: forum_topic_id is the topic identity within Chat, not an auxiliary aspect of a Chat row.
- pair: There is no key/value companion type.
- kv: Forum topic info belongs to a concrete chat/topic key, not account/global state.
- event: Forum topic info is current durable topic state.
Evidence:
- constructors: forumTopicInfo(chat_id:int53, forum_topic_id:int32, name:string, icon:forumTopicIcon, creation_date:int32, creator_id:MessageSender, is_general:Bool, is_outgoing:Bool, is_closed:Bool, is_hidden:Bool, is_name_implicit:Bool)
- update use: direct updateForumTopicInfo.info.
- type use: direct ForumTopic.info and ChatEventAction topic_info/old_topic_info/new_topic_info; indirect ForumTopics and chat event log containers expose ForumTopicInfo through ForumTopic or ChatEventAction.
- procedures: createForumTopic returns ForumTopicInfo; getForumTopic/getForumTopics return owners containing it; editForumTopic/deleteForumTopic/toggleForumTopicIsClosed/toggleGeneralForumTopicIsHidden mutate forum topic state by chat_id and forum_topic_id or general topic state by chat_id.
```

### ForwardSource

```text
Type: ForwardSource
Storage: embedded
Storage target: MessageForwardInfo.source
Decision: This is forward provenance inside MessageForwardInfo. chat_id/message_id point to the original source when known, but the source object is stored as part of the owning forwarded-message metadata.
Rejected:
- table: chat_id/message_id identify the original message when available; they do not identify this local ForwardSource value.
- extend: It does not extend Message or Chat; it is metadata inside MessageForwardInfo.
- facet: No separate owner-keyed lifecycle exists for ForwardSource outside the owning message forward info.
- pair: There is no key/value companion type.
- kv: Forward provenance belongs to concrete messages, not account/global state.
- event: Forward info is durable message metadata.
Evidence:
- constructors: forwardSource(chat_id:int53, message_id:int53, sender_id:MessageSender, sender_name:string, date:int32, is_outgoing:Bool)
- update use: indirect message update paths carrying Message.forward_info -> MessageForwardInfo.source.
- type use: direct MessageForwardInfo.source; indirect Message.forward_info and message owner containers expose ForwardSource through MessageForwardInfo.
- procedures: message-return procedures expose ForwardSource indirectly through Message.forward_info.source.
```

## Batch Review

All eight F types were completed without introducing a new storage kind.
