# Telegram Type Storage Classification Batch: Chat Revenue Source Theme Type Checklist

Input types:

```text
ChatRevenueAmount
ChatSource
ChatTheme
ChatType
Checklist
```

Source evidence:

- `packages/telegram/src/tdlib-docs/data/tdlibSchema.json`
- `packages/telegram/src/tdlib-docs/data/tdlibStorageReview.json`

Spreadsheet updates: none.

## Shared Evidence

`ChatTheme` and `Checklist` have large indirect fan-out through `Message`,
`MessageContent`, `LinkPreview`, notifications, downloads, quick replies, and
search results. The storage decision uses the nearest persisted owner type, not
every container that can return a message.

`ChatType` appears both in persistent chat state and in
`updateNewInlineQuery.chat_type`. The inline-query occurrence is an update
payload value; it is not a separate storage target for this batch.

## Decisions

### ChatRevenueAmount

```text
Type: ChatRevenueAmount
Storage: facet
Storage target: chat_id = Chat.id
Decision: This is current revenue state for a chat. The type has no own id, but updateChatRevenueAmount provides chat_id and replaces the amount for that chat.
Rejected:
- table: no primary key exists inside ChatRevenueAmount; the durable key is external chat_id.
- embedded: direct update use addresses the amount by chat_id without replacing a Chat field.
- extend: this does not structurally extend Chat; it is a separate revenue aspect.
- pair: there is no separate key/value companion type.
- kv: the value belongs to a concrete Chat, not account/global scope.
- event: the update describes current revenue state and must survive restart if revenue state is cached.
Evidence:
- constructors: chatRevenueAmount(cryptocurrency, total_amount, balance_amount, available_amount, withdrawal_enabled).
- update use: direct in updateChatRevenueAmount.revenue_amount with updateChatRevenueAmount.chat_id; no indirect update use.
- type use: direct in ChatRevenueStatistics.revenue_amount.
- procedures: getChatRevenueStatistics(chat_id, is_dark) returns ChatRevenueStatistics.revenue_amount; getChatRevenueTransactions(chat_id, offset, limit) reads the same chat revenue domain; getChatRevenueWithdrawalUrl(chat_id, password) acts on the same chat revenue domain; no procedure accepts ChatRevenueAmount directly.
```

### ChatSource

```text
Type: ChatSource
Storage: embedded
Storage target: ChatPosition.source
Decision: This is a reason value for why an external chat appears in a chat list. It has no identity and only exists as a nullable field on ChatPosition.
Rejected:
- table: no id and no procedure addresses ChatSource independently.
- extend: it does not extend ChatPosition; it is one nullable field.
- facet: ChatPosition is already the owner aspect keyed by chat_id and ChatList key; ChatSource is nested inside it.
- pair: there is no key/value companion type.
- kv: the value belongs to a specific ChatPosition, not account/global scope.
- event: source is part of current chat-list position state.
Evidence:
- constructors: chatSourceMtprotoProxy(); chatSourcePublicServiceAnnouncement(type, text).
- update use: indirect in updateNewChat.chat -> Chat.positions -> ChatPosition.source, updateChatPosition.position -> ChatPosition.source, updateChatLastMessage.positions -> ChatPosition.source, updateChatDraftMessage.positions -> ChatPosition.source.
- type use: direct in ChatPosition.source; indirect in Chat.positions.
- procedures: createBasicGroupChat, createNewSecretChat, createNewSupergroupChat, createPrivateChat, createSecretChat, createSupergroupChat, getChat, joinChatByInviteLink, searchChatAffiliateProgram, searchPublicChat, upgradeBasicGroupChatToSupergroupChat return Chat.positions with ChatPosition.source; no procedure accepts ChatSource directly.
```

### ChatTheme

```text
Type: ChatTheme
Storage: embedded
Storage target: Chat.theme, MessageContent.theme
Decision: This is a value object for a chat's selected theme and for service messages that record a theme change. updateChatTheme replaces Chat.theme by chat_id; messageChatSetTheme stores the same value as message content.
Rejected:
- table: no stable id exists inside ChatTheme; name and gift_theme are source values, not a row identity for ChatTheme.
- extend: it does not extend Chat; it is one nullable field.
- facet: the source shape is direct owner-field replacement on Chat.theme, not a separate owner aspect record.
- pair: there is no key/value companion type.
- kv: selected chat theme belongs to a concrete Chat or message content, not account/global scope.
- event: Chat.theme is durable current state; MessageContent.theme is persisted message payload.
Evidence:
- constructors: chatThemeEmoji(name); chatThemeGift(gift_theme).
- update use: direct in updateChatTheme.theme with updateChatTheme.chat_id; indirect in updateNewChat.chat -> Chat.theme and through message fan-out when MessageContent.messageChatSetTheme.theme appears in message updates.
- type use: direct in Chat.theme and MessageContent.theme via messageChatSetTheme.theme; indirect through Message, BusinessMessage, Chat.last_message, ForumTopic.last_message, notifications, downloads, quick replies, search result containers, and story/public forward containers.
- procedures: setChatTheme(chat_id, theme) accepts InputChatTheme, not ChatTheme; getGiftChatThemes returns GiftChatThemes, not ChatTheme; getChat and chat creation/search/join procedures return Chat.theme; message-return procedures return MessageContent.messageChatSetTheme.theme through Message containers.
```

### ChatType

```text
Type: ChatType
Storage: embedded
Storage target: Chat.type
Decision: This is the value that classifies a Chat as private, basic group, supergroup/channel, or secret. It also appears in inline-query update payloads, but the persistent owner is Chat.
Rejected:
- table: ChatType has no row id; its ids point to User, BasicGroup, Supergroup, or SecretChat owners.
- extend: it does not extend Chat; it is the chat classification field.
- facet: the related owner ids are the target chat entities, but ChatType itself is not a separate owner aspect record.
- pair: there is no key/value companion type.
- kv: the value belongs to a concrete Chat or inline-query payload, not account/global scope.
- event: Chat.type is durable chat state; the inline-query occurrence is event payload and does not change the type-level storage decision.
Evidence:
- constructors: chatTypePrivate(user_id); chatTypeBasicGroup(basic_group_id); chatTypeSupergroup(supergroup_id, is_channel); chatTypeSecret(secret_chat_id, user_id).
- update use: indirect in updateNewChat.chat -> Chat.type; direct in updateNewInlineQuery.chat_type as bot inline-query payload.
- type use: direct in Chat.type.
- procedures: createBasicGroupChat, createNewSecretChat, createNewSupergroupChat, createPrivateChat, createSecretChat, createSupergroupChat, getChat, joinChatByInviteLink, searchChatAffiliateProgram, searchPublicChat, upgradeBasicGroupChatToSupergroupChat return Chat.type; no procedure accepts ChatType directly.
```

### Checklist

```text
Type: Checklist
Storage: embedded
Storage target: MessageContent.list
Decision: Checklist is the payload of messageChecklist content. Procedures address the owning message by chat_id and message_id, while storage receives checklist state as MessageContent.
Rejected:
- table: Checklist has no own id; task ids are scoped inside the checklist message, not a Checklist row identity.
- extend: it does not extend Message; it is one MessageContent payload variant.
- facet: the owner aspect is Message.content keyed by Message identity; Checklist is nested under that content variant.
- pair: there is no key/value companion type.
- kv: the value belongs to a concrete Message, not account/global scope.
- event: checklist content is durable message state.
Evidence:
- constructors: checklist(title, tasks, others_can_add_tasks, can_add_tasks, others_can_mark_tasks_as_done, can_mark_tasks_as_done); tasks are vector<ChecklistTask>.
- update use: no direct root field; indirect through MessageContent.messageChecklist.list in updateNewMessage, updateMessageContent, updateChatLastMessage, updateChatReplyMarkup, updateMessageSendSucceeded, updateMessageSendFailed, updateNewBusinessMessage, updateBusinessMessageEdited, updateNewBusinessCallbackQuery, updateNewGuestQuery, updateActiveNotifications, updateNotification, updateNotificationGroup, updatePoll, updateQuickReplyShortcut, updateQuickReplyShortcutMessages, updateSavedMessagesTopic, updateDirectMessagesChatTopic, updateFileAddedToDownloads, updateServiceNotification, updateActiveLiveLocationMessages, updateNewChat.
- type use: direct in MessageContent.list via messageChecklist.list; indirect through Message, BusinessMessage, Chat.last_message, ForumTopic.last_message, notifications, downloads, quick replies, search result containers, and story/public forward containers.
- procedures: addChecklistTasks(chat_id, message_id, tasks) mutates checklist tasks by owning message; markChecklistTasksAsDone(chat_id, message_id, task ids) mutates task completion by owning message; editMessageChecklist(chat_id, message_id, checklist) and editBusinessMessageChecklist(business_connection_id, chat_id, message_id, checklist) accept InputChecklist and return Message/BusinessMessage with MessageContent.list; message-return procedures return Checklist through MessageContent.messageChecklist.list.
```

## Batch Review

Completed all requested input types. No new storage kind is required.

Framework note from the batch: direct update payload use does not automatically
make a type `event` when the same type also has a persistent owner field. The
storage target remains the persistent domain owner; event-only occurrences are
recorded in evidence.
