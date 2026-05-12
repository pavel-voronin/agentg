# Telegram Type Storage Classification Batch: Checklist Connection Contact

Input types:

```text
ChecklistTask
CloseBirthdayUser
ClosedVectorPath
ConnectionState
Contact
```

Source evidence:

- `packages/telegram/src/tdlib-docs/data/tdlib-schema.json`
- `packages/telegram/src/tdlib-docs/data/tdlib-storage-review.json`

Spreadsheet updates: none.

## Shared Evidence

`ChecklistTask` and `Contact` have large indirect fan-out through `Message`,
`MessageContent`, notifications, downloads, quick replies, and search results.
The storage decision uses the nearest persisted owner type, not every container
that can return a message.

`Contact` is not the Telegram contact-list storage type. Contact-list procedures
use `ImportedContact` and `Users`; this batch type is the contact payload used
in messages and inline query results.

## Decisions

### ChecklistTask

```text
Type: ChecklistTask
Storage: facet
Storage target: message.chat_id = Message.chat_id, message.id = Message.id, id
Decision: This is an owner-scoped child value of a checklist message. The task id is unique inside the checklist message, and procedures mutate tasks by chat_id, message_id, and task ids.
Rejected:
- table: the task id is not globally stable; it is scoped to the owning checklist message.
- embedded: task-level procedures add and mark tasks by id, so burying tasks only inside Checklist JSON loses the natural write shape.
- extend: this does not extend Message or Checklist; multiple tasks exist under one checklist.
- pair: there is no key/value companion type.
- kv: the value belongs to a concrete Message, not account/global scope.
- event: checklist tasks are durable message state.
Evidence:
- constructors: checklistTask(id, text, completed_by, completion_date).
- update use: no direct root field; indirect through Checklist.tasks and messageChecklistTasksAdded.tasks in updateNewMessage, updateMessageContent, updateChatLastMessage, updateChatReplyMarkup, updateMessageSendSucceeded, updateMessageSendFailed, updateNewBusinessMessage, updateBusinessMessageEdited, updateNewBusinessCallbackQuery, updateNewGuestQuery, updateActiveNotifications, updateNotification, updateNotificationGroup, updatePoll, updateQuickReplyShortcut, updateQuickReplyShortcutMessages, updateSavedMessagesTopic, updateDirectMessagesChatTopic, updateFileAddedToDownloads, updateServiceNotification, updateActiveLiveLocationMessages, updateNewChat.
- type use: direct in Checklist.tasks and MessageContent.tasks via messageChecklistTasksAdded.tasks; indirect through Message, BusinessMessage, Chat.last_message, ForumTopic.last_message, notifications, downloads, quick replies, search result containers, and story/public forward containers.
- procedures: addChecklistTasks(chat_id, message_id, tasks) adds tasks to a checklist message; markChecklistTasksAsDone(chat_id, message_id, marked_as_done_task_ids, marked_as_not_done_task_ids) mutates task completion by task id; editMessageChecklist and editBusinessMessageChecklist return updated Message/BusinessMessage with checklist content; message-return procedures return ChecklistTask through MessageContent paths.
```

### CloseBirthdayUser

```text
Type: CloseBirthdayUser
Storage: facet
Storage target: user_id = User.id
Decision: This is account-level current birthday proximity state for a known user. The update provides a complete list, and each row is keyed by the referenced user.
Rejected:
- table: user_id identifies User, not an independent CloseBirthdayUser entity.
- embedded: there is no owner field in User; updateContactCloseBirthdays sends a standalone collection.
- extend: it does not extend User; it is temporary account-level state about the user.
- pair: there is no key/value companion type.
- kv: the collection can be keyed per User; storing the whole list as one kv value would hide row identity and removal semantics.
- event: the update says the list has changed, so this is current cache state, not only a live signal.
Evidence:
- constructors: closeBirthdayUser(user_id, birthdate).
- update use: direct in updateContactCloseBirthdays.close_birthday_users.
- type use: none outside the update root.
- procedures: none accepts or returns CloseBirthdayUser.
```

### ClosedVectorPath

```text
Type: ClosedVectorPath
Storage: embedded
Storage target: Outline.paths
Decision: This is a vector drawing value inside Outline. It has no identity and is meaningful only as part of sticker outline geometry.
Rejected:
- table: no id or independently addressable row exists.
- extend: it does not extend Outline; Outline owns a list of paths.
- facet: there is no owner-keyed update or separate record shape for a path.
- pair: there is no key/value companion type.
- kv: this is not account/global state.
- event: outline geometry is returned cacheable data, not a live-only signal.
Evidence:
- constructors: closedVectorPath(commands).
- update use: indirect through Outline.paths in updateStickerSet and updateTrendingStickerSets.
- type use: direct in Outline.paths; indirect through StickerSet, StickerSetInfo, StickerSets, and TrendingStickerSets.
- procedures: getStickerOutline returns Outline.paths; createNewStickerSet, getArchivedStickerSets, getAttachedStickerSets, getInstalledStickerSets, getOwnedStickerSets, getStickerSet, getTrendingStickerSets, getWebAppPlaceholder, searchInstalledStickerSets, searchStickerSet, searchStickerSets return owners that contain Outline.paths.
```

### ConnectionState

```text
Type: ConnectionState
Storage: event
Storage target: connection_state
Decision: This is a live connection status signal. TDLib states that updateConnectionState must be used only to show a human-readable connection description, so persisting it would create stale state after restart.
Rejected:
- table: no id or row identity exists.
- embedded: no persistent owner field contains ConnectionState.
- extend: it does not extend an owner row.
- facet: there is no owner entity key.
- pair: there is no key/value companion type.
- kv: storing connection state as durable kv would cache stale connectivity after restart.
Evidence:
- constructors: connectionStateWaitingForNetwork(), connectionStateConnectingToProxy(), connectionStateConnecting(), connectionStateUpdating(), connectionStateReady().
- update use: direct in updateConnectionState.state.
- type use: none outside the update root.
- procedures: none accepts or returns ConnectionState.
```

### Contact

```text
Type: Contact
Storage: embedded
Storage target: MessageContent.contact, InlineQueryResult.contact
Decision: This is a contact payload value in messages and inline query results. user_id can point to a User if known, but the Contact value itself is not the User/contact-list entity.
Rejected:
- table: no durable Contact id exists; phone_number and user_id are payload fields, not a local contact-row identity.
- extend: it does not extend User; contacts can describe arbitrary phone/vCard data with user_id = 0.
- facet: there is no owner-keyed state separate from message or inline-result payload.
- pair: there is no key/value companion type.
- kv: this is not account/global state.
- event: contact messages are durable message payloads.
Evidence:
- constructors: contact(phone_number, first_name, last_name, vcard, user_id).
- update use: no direct root field; indirect through MessageContent.messageContact.contact in message updates, through DraftMessage/InputMessageContent paths in draft updates, and through InlineQueryResult.contact in inline-query result containers.
- type use: direct in MessageContent.contact, InputMessageContent.contact, InlineQueryResult.contact, InputInlineQueryResult.contact; indirect through Message, BusinessMessage, DraftMessage, Chat.last_message, ForumTopic.last_message, PreparedInlineMessage, InlineQueryResults, notifications, downloads, quick replies, search result containers, and story/public forward containers.
- procedures: sendMessage, sendBusinessMessage, sendMessageAlbum, sendBusinessMessageAlbum, addLocalMessage, addQuickReplyShortcutMessage, addQuickReplyShortcutMessageAlbum, setChatDraftMessage, editMessageMedia, editMessageText, editBusinessMessageMedia, editBusinessMessageText, editInlineMessageMedia, editInlineMessageText, editQuickReplyMessage, answerInlineQuery, answerWebAppQuery, answerGuestQuery, createInvoiceLink, savePreparedInlineMessage can accept Contact indirectly through input message or inline result payloads; getInlineQueryResults and getPreparedInlineMessage can return InlineQueryResult.contact; message-return procedures return MessageContent.contact. Contact-list procedures use ImportedContact/Users and are not storage evidence for Contact.
```

## Batch Review

Completed all requested input types. No new storage kind is required.

Framework note from the batch: owner-scoped child values with local ids fit the
existing `facet` kind when procedures address them by owner id plus local id.
`ChecklistTask` is the pilot case for this rule.
