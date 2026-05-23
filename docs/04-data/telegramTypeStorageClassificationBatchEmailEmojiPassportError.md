# Telegram Type Storage Classification Batch: Email Emoji Passport Error

Input types:

```text
EmailAddressAuthenticationCodeInfo
EmailAddressResetState
EmojiChatTheme
EmojiStatus
EmojiStatusType
Emojis
EncryptedCredentials
EncryptedPassportElement
Error
```

Source evidence:

- `packages/telegram/src/tdlib-docs/data/tdlibSchema.json`
- `packages/telegram/src/tdlib-docs/data/tdlibStorageReview.json`

Spreadsheet updates: none.

Batch status: completed.

## Decisions

### EmailAddressAuthenticationCodeInfo

```text
Type: EmailAddressAuthenticationCodeInfo
Storage: embedded
Storage target: AuthorizationState.code_info, PasswordState.recovery_email_address_code_info
Decision: This is flow-local code delivery metadata. It has no identity and only exists inside authorization or password recovery state.
Rejected:
- table: no id or independently addressable row exists.
- extend: it does not extend AuthorizationState or PasswordState; it is one nested field.
- facet: no owner-keyed record exists.
- pair: there is no key/value companion type.
- kv: the owner state may be kv, but this nested value is not itself account-level state.
- event: authorization/password recovery screens need the current value while the flow is active.
Evidence:
- constructors: emailAddressAuthenticationCodeInfo(email_address_pattern, length).
- update use: indirect in updateAuthorizationState.state -> AuthorizationState.code_info.
- type use: direct in AuthorizationState.code_info via authorizationStateWaitEmailCode and PasswordState.recovery_email_address_code_info.
- procedures: getAuthorizationState returns AuthorizationState.code_info; getPasswordState, setPassword, setRecoveryEmailAddress, sendEmailAddressVerificationCode, resendEmailAddressVerificationCode, checkRecoveryEmailAddressCode, requestPasswordRecovery, recoverPassword, resendRecoveryEmailAddressCode, cancelRecoveryEmailAddressVerification, setLoginEmailAddress, resendLoginEmailAddressCode return owner state containing this type.
```

### EmailAddressResetState

```text
Type: EmailAddressResetState
Storage: embedded
Storage target: AuthorizationState.email_address_reset_state
Decision: This is nullable reset metadata inside authorization email-code state. It has no identity and is meaningful only in that flow.
Rejected:
- table: no id or independently addressable row exists.
- extend: it does not extend AuthorizationState; it is a nested field.
- facet: no owner-keyed record exists.
- pair: there is no key/value companion type.
- kv: the owner state may be kv, but this nested value is not itself account-level state.
- event: authorization UI needs the current reset state while the flow is active.
Evidence:
- constructors: emailAddressResetStateAvailable(wait_period); emailAddressResetStatePending(reset_in).
- update use: indirect in updateAuthorizationState.state -> AuthorizationState.email_address_reset_state.
- type use: direct in AuthorizationState.email_address_reset_state via authorizationStateWaitEmailCode.
- procedures: getAuthorizationState returns AuthorizationState.email_address_reset_state.
```

### EmojiChatTheme

```text
Type: EmojiChatTheme
Storage: kv
Storage target: emoji_chat_themes
Decision: This is an account/global catalog of available emoji chat themes delivered as a replacement list by updateEmojiChatThemes.
Rejected:
- table: name is a selector, but the update shape is a whole catalog list and there is no per-theme update lifecycle.
- embedded: there is no owner field; the update root is the catalog list itself.
- extend: it does not extend another owner type.
- facet: there is no owner entity key.
- pair: there is no key/value companion type.
- event: available themes are cacheable current catalog state.
Evidence:
- constructors: emojiChatTheme(name, light_settings, dark_settings).
- update use: direct in updateEmojiChatThemes.chat_themes.
- type use: none outside the update root.
- procedures: none accepts or returns EmojiChatTheme directly.
```

### EmojiStatus

```text
Type: EmojiStatus
Storage: embedded
Storage target: User.emoji_status, Chat.emoji_status, ChatEventAction.old_emoji_status, ChatEventAction.new_emoji_status, EmojiStatuses.emoji_statuses
Decision: This is a nullable status value owned by a user, chat, audit event, or returned status list. It has no independent row identity.
Rejected:
- table: no id exists on EmojiStatus; nested ids belong to EmojiStatusType values.
- extend: it does not extend User or Chat; it is one field.
- facet: the write shape is direct owner-field replacement, not a separate owner-keyed record.
- pair: there is no key/value companion type.
- kv: status belongs to concrete owners or returned status lists, not account/global scope.
- event: user/chat emoji status is durable current state.
Evidence:
- constructors: emojiStatus(type, expiration_date).
- update use: direct in updateChatEmojiStatus.emoji_status; indirect in updateNewChat.chat -> Chat.emoji_status and updateUser.user -> User.emoji_status.
- type use: direct in User.emoji_status, Chat.emoji_status, ChatEventAction.old_emoji_status, ChatEventAction.new_emoji_status, EmojiStatuses.emoji_statuses; indirect through ChatEvents.
- procedures: setChatEmojiStatus, setEmojiStatus, setUserEmojiStatus accept EmojiStatus; getUser, getMe, getSupportUser, createBot, getMessageAuthor, getChat, chat creation/search/join procedures, getChatEventLog, getRecentEmojiStatuses, and getUpgradedGiftEmojiStatuses return owners containing EmojiStatus.
```

### EmojiStatusType

```text
Type: EmojiStatusType
Storage: embedded
Storage target: EmojiStatus.type
Decision: This is the nested selector for an EmojiStatus. Its ids identify external custom emoji or upgraded gift objects, not an EmojiStatusType row.
Rejected:
- table: custom_emoji_id and upgraded_gift_id identify referenced objects, not this value.
- extend: it does not extend EmojiStatus; it is one nested field.
- facet: no owner-keyed record exists.
- pair: there is no key/value companion type.
- kv: this is not account/global state.
- event: this is part of durable EmojiStatus owner state.
Evidence:
- constructors: emojiStatusTypeCustomEmoji(custom_emoji_id); emojiStatusTypeUpgradedGift(upgraded_gift_id, gift_title, gift_name, model_custom_emoji_id, symbol_custom_emoji_id, backdrop_colors).
- update use: indirect through EmojiStatus.type in updateChatEmojiStatus, updateNewChat, and updateUser.
- type use: direct in EmojiStatus.type; indirect through User.emoji_status, Chat.emoji_status, ChatEventAction emoji status fields, and EmojiStatuses.emoji_statuses.
- procedures: setChatEmojiStatus, setEmojiStatus, setUserEmojiStatus accept EmojiStatus.type; the same EmojiStatus-returning procedures return EmojiStatusType through EmojiStatus.
```

### Emojis

```text
Type: Emojis
Storage: embedded
Storage target: StickerSet.emojis
Decision: This is a list-of-strings value attached to StickerSet. Direct procedure returns are fresh results, not cached state.
Rejected:
- table: no id or independently addressable row exists.
- extend: it does not extend StickerSet; it is one field.
- facet: no owner-keyed record exists.
- pair: there is no key/value companion type.
- kv: direct procedure results do not define cache storage; the persistent owner path is StickerSet.emojis.
- event: sticker set emoji lists are durable sticker set payload.
Evidence:
- constructors: emojis(emojis).
- update use: indirect in updateStickerSet.sticker_set -> StickerSet.emojis.
- type use: direct in StickerSet.emojis.
- procedures: createNewStickerSet, getStickerSet, searchStickerSet return StickerSet.emojis; getAllStickerEmojis, getKeywordEmojis, getStickerEmojis, and searchStickerSet can return Emojis as fresh direct results.
```

### EncryptedCredentials

```text
Type: EncryptedCredentials
Storage: embedded
Storage target: MessageContent.credentials
Decision: This is Telegram Passport encrypted credential material inside messagePassportDataReceived. In this local single-client storage model it is stored as ordinary message content payload.
Rejected:
- table: no id or independently addressable row exists.
- extend: it does not extend MessageContent; it is one nested field.
- facet: no owner-keyed record exists.
- pair: there is no key/value companion type.
- kv: this is not account/global state.
- event: the payload is part of durable message content, not a transient notification.
Evidence:
- constructors: encryptedCredentials(data, hash, secret).
- update use: indirect through MessageContent.messagePassportDataReceived.credentials in message update fan-out.
- type use: direct in MessageContent.credentials via messagePassportDataReceived.credentials; indirect through Message, BusinessMessage, Chat.last_message, ForumTopic.last_message, notifications, downloads, quick replies, and message search containers.
- procedures: message-return procedures return EncryptedCredentials through MessageContent.messagePassportDataReceived.credentials; no procedure accepts EncryptedCredentials directly.
```

### EncryptedPassportElement

```text
Type: EncryptedPassportElement
Storage: embedded
Storage target: MessageContent.elements
Decision: This is Telegram Passport element payload inside messagePassportDataReceived. It has no own identity and is stored with the message content that delivered it.
Rejected:
- table: no id or independently addressable row exists.
- extend: it does not extend MessageContent; it is a nested list element.
- facet: no owner-keyed record exists.
- pair: there is no key/value companion type.
- kv: this is not account/global state.
- event: the payload is part of durable message content, not a transient notification.
Evidence:
- constructors: encryptedPassportElement(type, data, front_side, reverse_side, selfie, translation, files, value, hash).
- update use: indirect through MessageContent.messagePassportDataReceived.elements in message update fan-out.
- type use: direct in MessageContent.elements via messagePassportDataReceived.elements; nested DatedFile values keep their own embedded/file-reference handling.
- procedures: message-return procedures return EncryptedPassportElement through MessageContent.messagePassportDataReceived.elements; no procedure accepts EncryptedPassportElement directly.
```

### Error

```text
Type: Error
Storage: embedded
Storage target: MessageSendingState.error, CallState.error, SpeechRecognitionResult.error
Decision: Error is a nested failure value inside concrete owner state. Direct function errors are procedure results, not storage state.
Rejected:
- table: no stable domain identity exists; code/message are payload, not a row key.
- extend: it does not extend the owner state; it is one nested field.
- facet: no owner-keyed record exists.
- pair: there is no key/value companion type.
- kv: this is not account/global state.
- event: failed message/call/speech state can be part of durable owner state.
Evidence:
- constructors: error(code, message).
- update use: direct in updateGroupCallMessageSendFailed.error, updateMessageSendFailed.error, and updateStoryPostFailed.error.
- type use: direct in MessageSendingState.error, CallState.error, and SpeechRecognitionResult.error.
- procedures: finishFileGeneration accepts Error as an input payload; testReturnError accepts and can return Error for testing; every ordinary procedure can fail with Error as a direct result outside storage.
```
