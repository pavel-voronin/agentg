# Telegram Type Storage Classification Batch: I Types

## Input Types

1. InlineKeyboardButton
2. InlineKeyboardButtonType
3. InputChecklist
4. InputChecklistTask
5. InputFile
6. InputMessageContent
7. InputMessageReplyTo
8. InputPaidMedia
9. InputPaidMediaType
10. InputPollOption
11. InputPollType
12. InputSuggestedPostInfo
13. InputTextQuote
14. InputThumbnail
15. InternalLinkType
16. InviteLinkChatType
17. Invoice

## Shared Evidence

There are no H types in the current storage-review list, so this run continues
with I as the next non-empty letter.

Most I types are TDLib input shapes. They do not become canonical state after a
send/edit procedure succeeds; resulting messages store `MessageContent` and
related output types. The storage decision here covers the cases where an input
shape itself can be retained, such as draft state, inline-result input payloads,
payment form/receipt payloads, or parsed internal-link owner fields.

## Decisions

### InlineKeyboardButton

```text
Type: InlineKeyboardButton
Storage: embedded
Storage target: ReplyMarkup.rows
Decision: This is one button value inside inline keyboard reply markup. It has no identity and is stored only as an item in ReplyMarkup.rows.
Rejected:
- table: No standalone durable row identity exists for this value.
- extend: It does not structurally extend a single owner row; it is a nested value.
- facet: No separate owner-keyed lifecycle exists outside the owning field.
- pair: There is no key/value companion type.
- kv: The value belongs to concrete owner payloads, not account/global singleton state.
- event: The value can appear in durable owner payloads or persisted draft/result state, so it is not live-only.
Evidence:
- constructors: inlineKeyboardButton(text:string, icon_custom_emoji_id:int64, style:ButtonStyle, type:InlineKeyboardButtonType)
- update use: indirect message and inline-result update paths can carry ReplyMarkup.rows.
- type use: ReplyMarkup.rows.
- procedures: send/edit/answer inline procedures accept or return owners containing ReplyMarkup.rows.
```

### InlineKeyboardButtonType

```text
Type: InlineKeyboardButtonType
Storage: embedded
Storage target: InlineKeyboardButton.type
Decision: This is the action variant for an inline keyboard button. It has no identity and is meaningful only as InlineKeyboardButton.type.
Rejected:
- table: No standalone durable row identity exists for this value.
- extend: It does not structurally extend a single owner row; it is a nested value.
- facet: No separate owner-keyed lifecycle exists outside the owning field.
- pair: There is no key/value companion type.
- kv: The value belongs to concrete owner payloads, not account/global singleton state.
- event: The value can appear in durable owner payloads or persisted draft/result state, so it is not live-only.
Evidence:
- constructors: inlineKeyboardButtonTypeBuy(); inlineKeyboardButtonTypeCallback(data:bytes); inlineKeyboardButtonTypeCallbackGame(); inlineKeyboardButtonTypeCallbackWithPassword(data:bytes); inlineKeyboardButtonTypeCopyText(text:string); inlineKeyboardButtonTypeLoginUrl(url:string, id:int53, forward_text:string); inlineKeyboardButtonTypeSwitchInline(query:string, target_chat:TargetChat); inlineKeyboardButtonTypeUrl(url:string); inlineKeyboardButtonTypeUser(user_id:int53); inlineKeyboardButtonTypeWebApp(url:string)
- update use: indirect message and inline-result update paths can carry InlineKeyboardButton.type through ReplyMarkup.
- type use: InlineKeyboardButton.type.
- procedures: callback, web-app, login-url, and inline-switch flows are invoked from buttons; storage receives the type through ReplyMarkup owners.
```

### InputChecklist

```text
Type: InputChecklist
Storage: embedded
Storage target: InputMessageContent.checklist
Decision: This is an input checklist payload nested in inputMessageChecklist. It can be stored only as part of an input message content value such as DraftMessage.input_message_text.
Rejected:
- table: No standalone durable row identity exists for this value.
- extend: It does not structurally extend a single owner row; it is a nested value.
- facet: No separate owner-keyed lifecycle exists outside the owning field.
- pair: There is no key/value companion type.
- kv: The value belongs to concrete owner payloads, not account/global singleton state.
- event: The value can appear in durable owner payloads or persisted draft/result state, so it is not live-only.
Evidence:
- constructors: inputChecklist(title:formattedText, tasks:vector<inputChecklistTask>, others_can_add_tasks:Bool, others_can_mark_tasks_as_done:Bool)
- update use: draft updates can carry InputChecklist through DraftMessage.input_message_text.
- type use: InputMessageContent.checklist.
- procedures: editMessageChecklist(checklist) and editBusinessMessageChecklist(checklist) accept InputChecklist as procedure input.
```

### InputChecklistTask

```text
Type: InputChecklistTask
Storage: embedded
Storage target: InputChecklist.tasks
Decision: This is an input task value nested in InputChecklist.tasks. The task id is scoped to the checklist payload and is not a standalone row identity.
Rejected:
- table: No standalone durable row identity exists for this value.
- extend: It does not structurally extend a single owner row; it is a nested value.
- facet: No separate owner-keyed lifecycle exists outside the owning field.
- pair: There is no key/value companion type.
- kv: The value belongs to concrete owner payloads, not account/global singleton state.
- event: The value can appear in durable owner payloads or persisted draft/result state, so it is not live-only.
Evidence:
- constructors: inputChecklistTask(id:int32, text:formattedText)
- update use: draft updates can carry InputChecklistTask through InputChecklist inside InputMessageContent.
- type use: InputChecklist.tasks.
- procedures: addChecklistTasks(tasks) accepts InputChecklistTask values as procedure input.
```

### InputFile

```text
Type: InputFile
Storage: embedded
Storage target: InputMessageContent.animation, InputMessageContent.audio, InputMessageContent.document, InputMessageContent.photo, InputMessageContent.video, InputMessageContent.sticker, InputMessageContent.video_note, InputMessageContent.voice_note, InputMessageContent.cover, InputPaidMedia.media, InputPaidMediaType.video, InputPaidMediaType.cover, InputThumbnail.thumbnail
Decision: This is an upload/reference descriptor nested inside input media payloads. inputFileId references File.id, while local/remote/generated variants are payload descriptors for an owning input field.
Rejected:
- table: No standalone durable row identity exists for this value.
- extend: It does not structurally extend a single owner row; it is a nested value.
- facet: No separate owner-keyed lifecycle exists outside the owning field.
- pair: There is no key/value companion type.
- kv: The value belongs to concrete owner payloads, not account/global singleton state.
- event: The value can appear in durable owner payloads or persisted draft/result state, so it is not live-only.
Evidence:
- constructors: inputFileGenerated(original_path:string, conversion:string, expected_size:int53); inputFileId(id:int32); inputFileLocal(path:string); inputFileRemote(id:string)
- update use: draft updates can carry InputFile through InputMessageContent media fields.
- type use: InputMessageContent animation/audio/document/photo/video/sticker/video_note/voice_note/cover fields, InputPaidMedia.media, InputPaidMediaType.video/cover, InputThumbnail.thumbnail.
- procedures: preliminaryUploadFile, uploadStickerFile, importMessages, sticker/profile/audio/sound procedures, and call log upload accept InputFile as input.
```

### InputMessageContent

```text
Type: InputMessageContent
Storage: embedded
Storage target: DraftMessage.input_message_text, InputInlineQueryResult.input_message_content, InputPollOption.media, InputPollType.explanation_media
Decision: This is an input message payload. It has no own identity; when retained, it is nested under draft, inline-result input, or poll input owners.
Rejected:
- table: No standalone durable row identity exists for this value.
- extend: It does not structurally extend a single owner row; it is a nested value.
- facet: No separate owner-keyed lifecycle exists outside the owning field.
- pair: There is no key/value companion type.
- kv: The value belongs to concrete owner payloads, not account/global singleton state.
- event: The value can appear in durable owner payloads or persisted draft/result state, so it is not live-only.
Evidence:
- constructors: inputMessageAnimation, inputMessageAudio, inputMessageChecklist, inputMessageContact, inputMessageDice, inputMessageDocument, inputMessageForwarded, inputMessageGame, inputMessageInvoice, inputMessageLocation, inputMessagePaidMedia, inputMessagePhoto, inputMessagePoll, inputMessageStakeDice, inputMessageSticker, inputMessageStory, inputMessageText, inputMessageVenue, inputMessageVideo, inputMessageVideoNote, inputMessageVoiceNote.
- update use: draft updates carry DraftMessage.input_message_text.
- type use: DraftMessage.input_message_text, InputInlineQueryResult.input_message_content, InputPollOption.media, InputPollType.explanation_media.
- procedures: sendMessage/sendMessageAlbum/sendBusinessMessage/addLocalMessage/editMessageText/editMessageMedia/editInlineMessageText/editInlineMessageMedia/createInvoiceLink and quick-reply procedures accept InputMessageContent.
```

### InputMessageReplyTo

```text
Type: InputMessageReplyTo
Storage: embedded
Storage target: DraftMessage.reply_to
Decision: This is an input reply target stored only as the reply field of a draft or sent as procedure input. It has no lifecycle outside the owning draft/send payload.
Rejected:
- table: No standalone durable row identity exists for this value.
- extend: It does not structurally extend a single owner row; it is a nested value.
- facet: No separate owner-keyed lifecycle exists outside the owning field.
- pair: There is no key/value companion type.
- kv: The value belongs to concrete owner payloads, not account/global singleton state.
- event: The value can appear in durable owner payloads or persisted draft/result state, so it is not live-only.
Evidence:
- constructors: inputMessageReplyToExternalMessage(chat_id:int53, message_id:int53, quote:inputTextQuote, checklist_task_id:int32, poll_option_id:string); inputMessageReplyToMessage(message_id:int53, quote:inputTextQuote, checklist_task_id:int32, poll_option_id:string); inputMessageReplyToStory(story_poster_chat_id:int53, story_id:int32)
- update use: draft updates carry DraftMessage.reply_to.
- type use: DraftMessage.reply_to.
- procedures: sendMessage/sendMessageAlbum/sendBusinessMessage/sendInlineQueryResultMessage/openWebApp/addLocalMessage accept InputMessageReplyTo.
```

### InputPaidMedia

```text
Type: InputPaidMedia
Storage: embedded
Storage target: InputMessageContent.paid_media
Decision: This is a paid media item nested in input invoice or input paid-media message content.
Rejected:
- table: No standalone durable row identity exists for this value.
- extend: It does not structurally extend a single owner row; it is a nested value.
- facet: No separate owner-keyed lifecycle exists outside the owning field.
- pair: There is no key/value companion type.
- kv: The value belongs to concrete owner payloads, not account/global singleton state.
- event: The value can appear in durable owner payloads or persisted draft/result state, so it is not live-only.
Evidence:
- constructors: inputPaidMedia(type:InputPaidMediaType, media:InputFile, thumbnail:inputThumbnail, added_sticker_file_ids:vector<int32>, width:int32, height:int32)
- update use: draft updates can carry InputPaidMedia through InputMessageContent.
- type use: InputMessageContent.paid_media.
- procedures: send/edit/create invoice procedures accept InputPaidMedia through InputMessageContent.
```

### InputPaidMediaType

```text
Type: InputPaidMediaType
Storage: embedded
Storage target: InputPaidMedia.type
Decision: This is the media-kind variant for InputPaidMedia. It has no identity outside InputPaidMedia.type.
Rejected:
- table: No standalone durable row identity exists for this value.
- extend: It does not structurally extend a single owner row; it is a nested value.
- facet: No separate owner-keyed lifecycle exists outside the owning field.
- pair: There is no key/value companion type.
- kv: The value belongs to concrete owner payloads, not account/global singleton state.
- event: The value can appear in durable owner payloads or persisted draft/result state, so it is not live-only.
Evidence:
- constructors: inputPaidMediaTypePhoto(video:InputFile); inputPaidMediaTypeVideo(cover:InputFile, start_timestamp:int32, duration:int32, supports_streaming:Bool)
- update use: draft updates can carry InputPaidMediaType through InputPaidMedia.
- type use: InputPaidMedia.type.
- procedures: paid-media send/edit procedures accept InputPaidMediaType through InputPaidMedia.
```

### InputPollOption

```text
Type: InputPollOption
Storage: embedded
Storage target: InputMessageContent.options
Decision: This is one poll option inside an input poll message payload. It has no identity outside the owning input poll.
Rejected:
- table: No standalone durable row identity exists for this value.
- extend: It does not structurally extend a single owner row; it is a nested value.
- facet: No separate owner-keyed lifecycle exists outside the owning field.
- pair: There is no key/value companion type.
- kv: The value belongs to concrete owner payloads, not account/global singleton state.
- event: The value can appear in durable owner payloads or persisted draft/result state, so it is not live-only.
Evidence:
- constructors: inputPollOption(text:formattedText, media:InputMessageContent)
- update use: draft updates can carry InputPollOption through InputMessageContent.
- type use: InputMessageContent.options.
- procedures: addPollOption(option) accepts InputPollOption as input.
```

### InputPollType

```text
Type: InputPollType
Storage: embedded
Storage target: InputMessageContent.type
Decision: This is the quiz/regular type value for an input poll message. It is nested in inputMessagePoll.
Rejected:
- table: No standalone durable row identity exists for this value.
- extend: It does not structurally extend a single owner row; it is a nested value.
- facet: No separate owner-keyed lifecycle exists outside the owning field.
- pair: There is no key/value companion type.
- kv: The value belongs to concrete owner payloads, not account/global singleton state.
- event: The value can appear in durable owner payloads or persisted draft/result state, so it is not live-only.
Evidence:
- constructors: inputPollTypeQuiz(correct_option_ids:vector<int32>, explanation:formattedText, explanation_media:InputMessageContent); inputPollTypeRegular(allow_adding_options:Bool)
- update use: draft updates can carry InputPollType through InputMessageContent.
- type use: InputMessageContent.type.
- procedures: send/edit procedures accept InputPollType through InputMessageContent.
```

### InputSuggestedPostInfo

```text
Type: InputSuggestedPostInfo
Storage: embedded
Storage target: DraftMessage.suggested_post_info, MessageSendOptions.suggested_post_info
Decision: This is suggested-post input metadata nested in draft or send options. It has no identity outside those owner payloads.
Rejected:
- table: No standalone durable row identity exists for this value.
- extend: It does not structurally extend a single owner row; it is a nested value.
- facet: No separate owner-keyed lifecycle exists outside the owning field.
- pair: There is no key/value companion type.
- kv: The value belongs to concrete owner payloads, not account/global singleton state.
- event: The value can appear in durable owner payloads or persisted draft/result state, so it is not live-only.
Evidence:
- constructors: inputSuggestedPostInfo(price:SuggestedPostPrice, send_date:int32)
- update use: draft updates carry DraftMessage.suggested_post_info.
- type use: DraftMessage.suggested_post_info, MessageSendOptions.suggested_post_info.
- procedures: send/edit procedures accept MessageSendOptions.suggested_post_info or DraftMessage.suggested_post_info through owner payloads.
```

### InputTextQuote

```text
Type: InputTextQuote
Storage: embedded
Storage target: InputMessageReplyTo.quote
Decision: This is a manually selected quote nested in an input reply target. It has no identity outside InputMessageReplyTo.quote.
Rejected:
- table: No standalone durable row identity exists for this value.
- extend: It does not structurally extend a single owner row; it is a nested value.
- facet: No separate owner-keyed lifecycle exists outside the owning field.
- pair: There is no key/value companion type.
- kv: The value belongs to concrete owner payloads, not account/global singleton state.
- event: The value can appear in durable owner payloads or persisted draft/result state, so it is not live-only.
Evidence:
- constructors: inputTextQuote(text:formattedText, position:int32)
- update use: draft updates can carry InputTextQuote through DraftMessage.reply_to.
- type use: InputMessageReplyTo.quote.
- procedures: resendMessages(quote) accepts InputTextQuote as input.
```

### InputThumbnail

```text
Type: InputThumbnail
Storage: embedded
Storage target: InputMessageContent.thumbnail, InputMessageContent.album_cover_thumbnail, InputPaidMedia.thumbnail
Decision: This is a thumbnail upload descriptor nested in input media payloads. It has no identity outside the owning media input.
Rejected:
- table: No standalone durable row identity exists for this value.
- extend: It does not structurally extend a single owner row; it is a nested value.
- facet: No separate owner-keyed lifecycle exists outside the owning field.
- pair: There is no key/value companion type.
- kv: The value belongs to concrete owner payloads, not account/global singleton state.
- event: The value can appear in durable owner payloads or persisted draft/result state, so it is not live-only.
Evidence:
- constructors: inputThumbnail(thumbnail:InputFile, width:int32, height:int32)
- update use: draft updates can carry InputThumbnail through InputMessageContent.
- type use: InputMessageContent.thumbnail, InputMessageContent.album_cover_thumbnail, InputPaidMedia.thumbnail.
- procedures: send/edit media procedures accept InputThumbnail through InputMessageContent or InputPaidMedia.
```

### InternalLinkType

```text
Type: InternalLinkType
Storage: embedded
Storage target: BotInfo.edit_commands_link, BotInfo.edit_description_link, BotInfo.edit_description_media_link, BotInfo.edit_settings_link, PremiumFeatures.payment_link, PremiumPaymentOption.payment_link, TargetChat.link, WebPageInstantView.feedback_link
Decision: This is a parsed internal-link action value. It is stored as fields on bot/premium/target/instant-view owners or returned by getInternalLinkType for immediate routing.
Rejected:
- table: No standalone durable row identity exists for this value.
- extend: It does not structurally extend a single owner row; it is a nested value.
- facet: No separate owner-keyed lifecycle exists outside the owning field.
- pair: There is no key/value companion type.
- kv: The value belongs to concrete owner payloads, not account/global singleton state.
- event: The value can appear in durable owner payloads or persisted draft/result state, so it is not live-only.
Evidence:
- constructors: internalLinkTypeAttachmentMenuBot, internalLinkTypeAuthenticationCode, internalLinkTypeBackground, internalLinkTypeBotAddToChannel, internalLinkTypeBotStart, internalLinkTypeBotStartInGroup, internalLinkTypeBusinessChat, internalLinkTypeCallsPage, internalLinkTypeChatAffiliateProgram, internalLinkTypeChatBoost, internalLinkTypeChatFolderInvite, internalLinkTypeChatInvite, internalLinkTypeChatSelection, internalLinkTypeContactsPage, internalLinkTypeDirectMessagesChat, internalLinkTypeGame, internalLinkTypeGiftAuction, internalLinkTypeGiftCollection, internalLinkTypeGroupCall, internalLinkTypeInstantView, internalLinkTypeInvoice, internalLinkTypeLanguagePack, internalLinkTypeLiveStory, internalLinkTypeMainWebApp, internalLinkTypeMessage, internalLinkTypeMessageDraft, internalLinkTypeMyProfilePage, internalLinkTypeNewChannelChat, internalLinkTypeNewGroupChat, internalLinkTypeNewPrivateChat, internalLinkTypeNewStory, internalLinkTypeOauth, internalLinkTypePassportDataRequest, internalLinkTypePhoneNumberConfirmation, internalLinkTypePremiumFeaturesPage, internalLinkTypePremiumGiftCode, internalLinkTypePremiumGiftPurchase, internalLinkTypeProxy, internalLinkTypePublicChat, internalLinkTypeQrCodeAuthentication, internalLinkTypeRequestManagedBot, internalLinkTypeRestorePurchases, internalLinkTypeSavedMessages, internalLinkTypeSearch, internalLinkTypeSettings, internalLinkTypeStarPurchase, internalLinkTypeStickerSet, internalLinkTypeStory, internalLinkTypeStoryAlbum, internalLinkTypeTextCompositionStyle, internalLinkTypeTheme, internalLinkTypeUnknownDeepLink, internalLinkTypeUpgradedGift, internalLinkTypeUserPhoneNumber, internalLinkTypeUserToken, internalLinkTypeVideoChat, internalLinkTypeWebApp.
- update use: owners such as BotInfo, PremiumFeatures, PremiumPaymentOption, TargetChat, and WebPageInstantView can arrive through their normal result/update paths.
- type use: BotInfo edit links, PremiumFeatures.payment_link, PremiumPaymentOption.payment_link, TargetChat.link, WebPageInstantView.feedback_link.
- procedures: getInternalLinkType(link) returns InternalLinkType; getInternalLink(type) accepts InternalLinkType.
```

### InviteLinkChatType

```text
Type: InviteLinkChatType
Storage: embedded
Storage target: ChatInviteLinkInfo.type, LinkPreviewType.type
Decision: This is an enum-like chat-kind value for invite links and link previews. It has no identity outside those owners.
Rejected:
- table: No standalone durable row identity exists for this value.
- extend: It does not structurally extend a single owner row; it is a nested value.
- facet: No separate owner-keyed lifecycle exists outside the owning field.
- pair: There is no key/value companion type.
- kv: The value belongs to concrete owner payloads, not account/global singleton state.
- event: The value can appear in durable owner payloads or persisted draft/result state, so it is not live-only.
Evidence:
- constructors: inviteLinkChatTypeBasicGroup(); inviteLinkChatTypeChannel(); inviteLinkChatTypeSupergroup()
- update use: chat invite/link preview result paths carry InviteLinkChatType through owner fields.
- type use: ChatInviteLinkInfo.type, LinkPreviewType.type.
- procedures: checkChatInviteLink and link preview procedures expose InviteLinkChatType through owner result types.
```

### Invoice

```text
Type: Invoice
Storage: embedded
Storage target: InputMessageContent.invoice, PaymentFormType.invoice, PaymentReceiptType.invoice
Decision: This is product invoice payload stored inside input invoice messages, payment forms, and payment receipts. It has no standalone invoice row identity in this type.
Rejected:
- table: No standalone durable row identity exists for this value.
- extend: It does not structurally extend a single owner row; it is a nested value.
- facet: No separate owner-keyed lifecycle exists outside the owning field.
- pair: There is no key/value companion type.
- kv: The value belongs to concrete owner payloads, not account/global singleton state.
- event: The value can appear in durable owner payloads or persisted draft/result state, so it is not live-only.
Evidence:
- constructors: invoice(currency:string, price_parts:vector<labeledPricePart>, subscription_period:int32, max_tip_amount:int53, suggested_tip_amounts:vector<int53>, recurring_payment_terms_of_service_url:string, terms_of_service_url:string, is_test:Bool, need_name:Bool, need_phone_number:Bool, need_email_address:Bool, need_shipping_address:Bool, send_phone_number_to_provider:Bool, send_email_address_to_provider:Bool, is_flexible:Bool)
- update use: payment form/receipt result paths and draft input invoice payloads can carry Invoice.
- type use: InputMessageContent.invoice, PaymentFormType.invoice, PaymentReceiptType.invoice.
- procedures: createInvoiceLink accepts Invoice through InputMessageContent; getPaymentForm/getPaymentReceipt expose Invoice through payment form/receipt owner types.
```

## Batch Review

All 17 I types were completed without introducing a new storage kind.
