# Telegram Type Storage Classification Batch: Datetime Files Topics Drafts

Input types:

```text
DateTimeFormattingType
DateTimePartPrecision
DatedFile
DiceStickers
DirectMessagesChatTopic
Document
DownloadedFileCounts
DraftMessage
```

Source evidence:

- `packages/telegram/src/tdlib-docs/data/tdlibSchema.json`
- `packages/telegram/src/tdlib-docs/data/tdlibStorageReview.json`

Spreadsheet updates: none.

## Shared Evidence

`DateTimeFormattingType` and `DateTimePartPrecision` fan out through
`FormattedText` and `TextEntity`. The nearest storage owner is
`TextEntityType`, not every type that contains formatted text.

`Document`, `DiceStickers`, and `DraftMessage` fan out through message
containers. The storage decision uses the nearest persisted owner field.

## Decisions

### DateTimeFormattingType

```text
Type: DateTimeFormattingType
Storage: embedded
Storage target: TextEntityType.formatting_type
Decision: This is a formatting value for textEntityTypeDateTime. It has no identity and only changes how a date-time entity should be rendered.
Rejected:
- table: no id or independently addressable row exists.
- extend: it does not extend TextEntityType; it is one nullable field.
- facet: there is no owner-keyed record separate from TextEntityType.
- pair: there is no key/value companion type.
- kv: this is not account/global state.
- event: this is durable formatted-text payload, not a live-only signal.
Evidence:
- constructors: dateTimeFormattingTypeAbsolute(time_precision, date_precision, show_day_of_week); dateTimeFormattingTypeRelative().
- update use: no direct root field; indirect through FormattedText/TextEntity in many updates, including message, story, user full info, terms of service, authorization registration, chat folder, and text-composition updates.
- type use: direct in TextEntityType.formatting_type via textEntityTypeDateTime.formatting_type; indirect through TextEntity and FormattedText owners.
- procedures: many text/message procedures accept or return FormattedText containing TextEntityType.formatting_type; no procedure accepts or returns DateTimeFormattingType directly.
```

### DateTimePartPrecision

```text
Type: DateTimePartPrecision
Storage: embedded
Storage target: DateTimeFormattingType.time_precision, DateTimeFormattingType.date_precision
Decision: This is a nested enum-like value inside dateTimeFormattingTypeAbsolute. It has no identity and no use outside DateTimeFormattingType.
Rejected:
- table: no id or row identity exists.
- extend: it does not extend DateTimeFormattingType; it is a nested value field.
- facet: there is no owner-keyed record.
- pair: there is no key/value companion type.
- kv: this is not account/global state.
- event: this is durable formatted-text payload, not a live-only signal.
Evidence:
- constructors: dateTimePartPrecisionNone(); dateTimePartPrecisionShort(); dateTimePartPrecisionLong().
- update use: no direct root field; indirect through DateTimeFormattingType -> TextEntityType -> TextEntity -> FormattedText.
- type use: direct in DateTimeFormattingType.time_precision and DateTimeFormattingType.date_precision.
- procedures: many text/message procedures accept or return FormattedText containing DateTimePartPrecision through DateTimeFormattingType; no procedure accepts or returns DateTimePartPrecision directly.
```

### DatedFile

```text
Type: DatedFile
Storage: embedded
Storage target: EncryptedPassportElement.front_side, EncryptedPassportElement.reverse_side, EncryptedPassportElement.selfie, EncryptedPassportElement.translation, EncryptedPassportElement.files, IdentityDocument.front_side, IdentityDocument.reverse_side, IdentityDocument.selfie, IdentityDocument.translation, PersonalDocument.files, PersonalDocument.translation
Decision: This is a file reference plus upload date inside passport/document structures. The nested File has its own identity; DatedFile itself is owner-owned payload.
Rejected:
- table: no id exists on DatedFile; file.id belongs to File, not to DatedFile.
- extend: it does not extend File or passport documents; it is one nested document file value.
- facet: there is no procedure or update addressing DatedFile by owner key.
- pair: there is no key/value companion type.
- kv: this is not account/global state.
- event: passport/document file data is durable payload.
Evidence:
- constructors: datedFile(file, date).
- update use: no direct root field; indirect through message/passport data containers in message updates and through file download/message fan-out.
- type use: direct in EncryptedPassportElement front_side/reverse_side/selfie/translation/files, IdentityDocument front_side/reverse_side/selfie/translation, and PersonalDocument files/translation; indirect through PassportElement and message containers.
- procedures: getAllPassportElements, getPassportAuthorizationFormAvailableElements, getPassportElement, setPassportElement and message-return procedures can return DatedFile through passport/message containers; no procedure accepts DatedFile directly.
```

### DiceStickers

```text
Type: DiceStickers
Storage: embedded
Storage target: MessageContent.initial_state, MessageContent.final_state
Decision: This is dice animation payload inside dice message content. It has no identity; nested Sticker values carry their own sticker identity.
Rejected:
- table: no id exists on DiceStickers.
- extend: it does not extend MessageContent; it is a content field.
- facet: no owner-keyed record exists separate from MessageContent.
- pair: there is no key/value companion type.
- kv: this is not account/global state.
- event: dice message content is durable message state.
Evidence:
- constructors: diceStickersRegular(sticker); diceStickersSlotMachine(background, lever, left_reel, center_reel, right_reel).
- update use: no direct root field; indirect through MessageContent.messageDice initial_state/final_state and MessageContent.messageStakeDice initial_state/final_state in message updates.
- type use: direct in MessageContent.initial_state and MessageContent.final_state for messageDice and messageStakeDice; indirect through Message, BusinessMessage, Chat.last_message, ForumTopic.last_message, notifications, downloads, quick replies, search result containers, and story/public forward containers.
- procedures: message-return procedures return DiceStickers through MessageContent; no procedure accepts DiceStickers directly.
```

### DirectMessagesChatTopic

```text
Type: DirectMessagesChatTopic
Storage: table
Storage target: chat_id = Chat.id, id
Decision: This is an addressable topic inside a channel direct messages chat. It has a scoped topic id, arrives as a root update value, and procedures read or mutate it by chat_id and topic_id.
Rejected:
- embedded: it is not a field of Chat in the source shape; updateDirectMessagesChatTopic carries a complete topic object, and getDirectMessagesChatTopic addresses it by key.
- extend: it does not extend Chat; many topics can exist for one chat.
- facet: the type has its own scoped identity and topic-level lifecycle, so it is stronger than an owner aspect.
- pair: there is no key/value companion type.
- kv: the value belongs to a concrete chat/topic key, not account/global scope.
- event: topic state is durable and must be available after restart.
Evidence:
- constructors: directMessagesChatTopic(chat_id, id, sender_id, order, can_send_unpaid_messages, is_marked_as_unread, unread_count, last_read_inbox_message_id, last_read_outbox_message_id, unread_reaction_count, last_message, draft_message).
- update use: direct in updateDirectMessagesChatTopic.topic.
- type use: none outside the update root.
- procedures: getDirectMessagesChatTopic(chat_id, topic_id) returns DirectMessagesChatTopic; getDirectMessagesChatTopicHistory, getDirectMessagesChatTopicMessageByDate, deleteDirectMessagesChatTopicHistory, deleteDirectMessagesChatTopicMessagesByDate, readAllDirectMessagesChatTopicReactions, setDirectMessagesChatTopicIsMarkedAsUnread, toggleDirectMessagesChatTopicCanSendUnpaidMessages, unpinAllDirectMessagesChatTopicMessages, getDirectMessagesChatTopicRevenue, and loadDirectMessagesChatTopics address the same chat/topic domain by chat_id and topic_id.
```

### Document

```text
Type: Document
Storage: embedded
Storage target: Background.document, InlineQueryResult.document, LinkPreviewType.document, LinkPreviewType.documents, MessageContent.document, PushMessageContent.document, RichText.document
Decision: This is document metadata plus a nested File reference. The nested File owns file identity; Document itself is payload under message, background, link preview, inline result, push content, or rich text.
Rejected:
- table: no document id exists; document.file.id belongs to File.
- extend: it does not extend File or MessageContent; it is a nested payload value.
- facet: there is no owner-keyed Document record addressed by procedures.
- pair: there is no key/value companion type.
- kv: this is not account/global state.
- event: documents are durable payload in messages/backgrounds/previews.
Evidence:
- constructors: document(file_name, mime_type, minithumbnail, thumbnail, document).
- update use: no direct root field; indirect through Background.document, MessageContent.messageDocument.document, LinkPreviewType.document/documents, RichText.document, and message/background/theme update fan-out.
- type use: direct in Background.document, InlineQueryResult.document, LinkPreviewType.document, LinkPreviewType.documents, MessageContent.document, PushMessageContent.document, RichText.document; indirect through Message, BusinessMessage, Chat.last_message, ChatBackground, ChatTheme, PageBlock/RichText, notifications, downloads, quick replies, search result containers, and story/public forward containers.
- procedures: getInstalledBackgrounds, searchBackground, setDefaultBackground, getGiftChatThemes, getInlineQueryResults, getLinkPreview, getWebPageInstantView, and message-return procedures return Document through the owner paths; no procedure accepts Document directly.
```

### DownloadedFileCounts

```text
Type: DownloadedFileCounts
Storage: kv
Storage target: downloaded_file_counts
Decision: This is account-level current aggregate state for the file download list. The update roots provide replacement counts without an entity owner.
Rejected:
- table: no row identity exists.
- embedded: updateFileAddedToDownloads, updateFileDownload, and updateFileRemovedFromDownloads provide counts as a root aggregate, not as a field of a stored owner entity.
- extend: it does not extend FileDownload; it is aggregate state for the whole download list.
- facet: there is no owner key.
- pair: there is no key/value companion type.
- event: the counts describe current download-list state and are useful after restart once the list is loaded.
Evidence:
- constructors: downloadedFileCounts(active_count, paused_count, completed_count).
- update use: direct in updateFileAddedToDownloads.counts, updateFileDownload.counts, updateFileRemovedFromDownloads.counts.
- type use: direct in FoundFileDownloads.total_counts.
- procedures: searchFileDownloads returns FoundFileDownloads.total_counts; no procedure accepts DownloadedFileCounts directly.
```

### DraftMessage

```text
Type: DraftMessage
Storage: embedded
Storage target: Chat.draft_message, ForumTopic.draft_message, DirectMessagesChatTopic.draft_message, SavedMessagesTopic.draft_message, MessageThreadInfo.draft_message
Decision: This is a nullable draft value owned by a chat or topic-like owner. Updates and procedures address the owner, while DraftMessage itself has no identity.
Rejected:
- table: no draft id exists.
- extend: it does not extend Chat or topic rows; it is one nullable field.
- facet: the write shape is owner-field replacement, not a separate owner-keyed record.
- pair: there is no key/value companion type.
- kv: draft state belongs to concrete chat/topic owners, not account/global scope.
- event: drafts are current state and must survive restart if cached.
Evidence:
- constructors: draftMessage(reply_to, date, input_message_text, effect_id, suggested_post_info).
- update use: direct in updateChatDraftMessage.draft_message and updateForumTopic.draft_message; indirect in updateNewChat.chat -> Chat.draft_message, updateDirectMessagesChatTopic.topic -> DirectMessagesChatTopic.draft_message, and updateSavedMessagesTopic.topic -> SavedMessagesTopic.draft_message.
- type use: direct in Chat.draft_message, DirectMessagesChatTopic.draft_message, ForumTopic.draft_message, MessageThreadInfo.draft_message, SavedMessagesTopic.draft_message.
- procedures: setChatDraftMessage(chat_id, topic_id, draft_message) changes the draft for a chat or topic; getChat, getForumTopic, getForumTopics, getDirectMessagesChatTopic, getMessageThread, chat creation/search/join procedures, and update-return paths expose DraftMessage through owner fields.
```

## Batch Review

Completed all requested input types. No new storage kind is required.

Framework note from the batch: types inside `FormattedText` should be classified
at the nearest text entity owner. Listing every formatted-text container as a
storage target makes the decision less precise.
