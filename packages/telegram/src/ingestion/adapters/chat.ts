import type { JsonValue } from '@agentg/framework';
import type { chat as TdlibChat } from 'tdlib-types';

import type {
  ChatPositionRemovedChange,
  ChatPositionUpsertedChange,
  ChatPositionsReplacedChange,
  ChatListMembershipAddedChange,
  ChatListMembershipRemovedChange,
  ChatSavedChange,
  ChatUpdatedChange,
  DomainChange
} from '../../domain/changes.js';
import type { ChatPositionState, ChatState, ChatPatch } from '../../domain/models/chatState.js';
import { tdId, tdJsonObject, tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';
import { savedMessageChanges } from './message.js';

type ChatPosition = TdlibChat['positions'][number];
type ChatAccentColorsUpdate = UpdateByType<'updateChatAccentColors'>;
type ChatActionBarUpdate = UpdateByType<'updateChatActionBar'>;
type ChatAvailableReactionsUpdate = UpdateByType<'updateChatAvailableReactions'>;
type ChatBlockListUpdate = UpdateByType<'updateChatBlockList'>;
type ChatBusinessBotManageBarUpdate = UpdateByType<'updateChatBusinessBotManageBar'>;
type ChatDefaultDisableNotificationUpdate = UpdateByType<'updateChatDefaultDisableNotification'>;
type ChatDraftMessageUpdate = UpdateByType<'updateChatDraftMessage'>;
type ChatEmojiStatusUpdate = UpdateByType<'updateChatEmojiStatus'>;
type ChatHasProtectedContentUpdate = UpdateByType<'updateChatHasProtectedContent'>;
type ChatHasScheduledMessagesUpdate = UpdateByType<'updateChatHasScheduledMessages'>;
type ChatIsMarkedAsUnreadUpdate = UpdateByType<'updateChatIsMarkedAsUnread'>;
type ChatIsTranslatableUpdate = UpdateByType<'updateChatIsTranslatable'>;
type ChatLastMessageUpdate = UpdateByType<'updateChatLastMessage'>;
type ChatAddedToListUpdate = UpdateByType<'updateChatAddedToList'>;
type ChatMessageAutoDeleteTimeUpdate = UpdateByType<'updateChatMessageAutoDeleteTime'>;
type ChatMessageSenderUpdate = UpdateByType<'updateChatMessageSender'>;
type ChatNotificationSettingsUpdate = UpdateByType<'updateChatNotificationSettings'>;
type ChatPendingJoinRequestsUpdate = UpdateByType<'updateChatPendingJoinRequests'>;
type ChatPermissionsUpdate = UpdateByType<'updateChatPermissions'>;
type ChatPositionUpdate = UpdateByType<'updateChatPosition'>;
type ChatReadInboxUpdate = UpdateByType<'updateChatReadInbox'>;
type ChatReadOutboxUpdate = UpdateByType<'updateChatReadOutbox'>;
type ChatRemovedFromListUpdate = UpdateByType<'updateChatRemovedFromList'>;
type ChatReplyMarkupUpdate = UpdateByType<'updateChatReplyMarkup'>;
type ChatTitleUpdate = UpdateByType<'updateChatTitle'>;
type ChatUnreadMentionCountUpdate = UpdateByType<'updateChatUnreadMentionCount'>;
type ChatUnreadPollVoteCountUpdate = UpdateByType<'updateChatUnreadPollVoteCount'>;
type ChatUnreadReactionCountUpdate = UpdateByType<'updateChatUnreadReactionCount'>;
type ChatVideoChatUpdate = UpdateByType<'updateChatVideoChat'>;
type ChatViewAsTopicsUpdate = UpdateByType<'updateChatViewAsTopics'>;
type MessageContainsUnreadPollVotesUpdate = UpdateByType<'updateMessageContainsUnreadPollVotes'>;
type MessageMentionReadUpdate = UpdateByType<'updateMessageMentionRead'>;
type MessageUnreadReactionsUpdate = UpdateByType<'updateMessageUnreadReactions'>;

export function savedChatChanges(chat: TdlibChat): DomainChange[] {
  const lastMessage = chat.last_message ?? null;
  return [
    ...(lastMessage === null ? [] : savedMessageChanges(lastMessage)),
    {
      kind: 'chat.saved',
      chat: chatStateFromTdlibChat(chat),
      positions: chatPositionRecordsFromTdlibPositions(String(chat.id), chat.positions)
    } satisfies ChatSavedChange
  ];
}

export function updatedChatStateChanges(chat: ChatPatch): DomainChange[] {
  return [
    {
      kind: 'chat.updated',
      chat
    } satisfies ChatUpdatedChange
  ];
}

export function chatAccentColorsChanges(update: ChatAccentColorsUpdate): DomainChange[] {
  return updatedChatStateChanges({
    accentColorId: update.accent_color_id,
    backgroundCustomEmojiId: tdId(update.background_custom_emoji_id),
    id: String(update.chat_id),
    profileAccentColorId: update.profile_accent_color_id,
    profileBackgroundCustomEmojiId: tdId(update.profile_background_custom_emoji_id),
    upgradedGiftColors: nullableJsonValue(update.upgraded_gift_colors)
  });
}

export function chatActionBarChanges(update: ChatActionBarUpdate): DomainChange[] {
  return updatedChatStateChanges({
    actionBar: nullableJsonValue(update.action_bar),
    id: String(update.chat_id)
  });
}

export function chatAvailableReactionsChanges(
  update: ChatAvailableReactionsUpdate
): DomainChange[] {
  return updatedChatStateChanges({
    availableReactions: tdJsonObject(update.available_reactions),
    id: String(update.chat_id)
  });
}

export function chatBlockListChanges(update: ChatBlockListUpdate): DomainChange[] {
  return updatedChatStateChanges({
    blockList: nullableJsonValue(update.block_list),
    id: String(update.chat_id)
  });
}

export function chatBusinessBotManageBarChanges(
  update: ChatBusinessBotManageBarUpdate
): DomainChange[] {
  return updatedChatStateChanges({
    businessBotManageBar: nullableJsonValue(update.business_bot_manage_bar),
    id: String(update.chat_id)
  });
}

export function chatDefaultDisableNotificationChanges(
  update: ChatDefaultDisableNotificationUpdate
): DomainChange[] {
  return updatedChatStateChanges({
    defaultDisableNotification: update.default_disable_notification,
    id: String(update.chat_id)
  });
}

export function chatDraftMessageChanges(update: ChatDraftMessageUpdate): DomainChange[] {
  const chatId = String(update.chat_id);
  return [
    ...updatedChatStateChanges({
      draftMessage: nullableJsonValue(update.draft_message),
      id: chatId
    }),
    replacedChatPositionsChange(chatId, update.positions)
  ];
}

export function chatEmojiStatusChanges(update: ChatEmojiStatusUpdate): DomainChange[] {
  return updatedChatStateChanges({
    emojiStatus: nullableJsonValue(update.emoji_status),
    id: String(update.chat_id)
  });
}

export function chatHasProtectedContentChanges(
  update: ChatHasProtectedContentUpdate
): DomainChange[] {
  return updatedChatStateChanges({
    hasProtectedContent: update.has_protected_content,
    id: String(update.chat_id)
  });
}

export function chatHasScheduledMessagesChanges(
  update: ChatHasScheduledMessagesUpdate
): DomainChange[] {
  return updatedChatStateChanges({
    hasScheduledMessages: update.has_scheduled_messages,
    id: String(update.chat_id)
  });
}

export function chatIsMarkedAsUnreadChanges(update: ChatIsMarkedAsUnreadUpdate): DomainChange[] {
  return updatedChatStateChanges({
    id: String(update.chat_id),
    isMarkedAsUnread: update.is_marked_as_unread
  });
}

export function chatIsTranslatableChanges(update: ChatIsTranslatableUpdate): DomainChange[] {
  return updatedChatStateChanges({
    id: String(update.chat_id),
    isTranslatable: update.is_translatable
  });
}

export function chatLastMessageChanges(update: ChatLastMessageUpdate): DomainChange[] {
  const chatId = String(update.chat_id);
  const lastMessage = update.last_message ?? null;
  return [
    ...(lastMessage === null ? [] : savedMessageChanges(lastMessage)),
    ...updatedChatStateChanges({
      id: chatId,
      lastMessageChatId: lastMessage === null ? null : String(lastMessage.chat_id),
      lastMessageId: lastMessage === null ? null : String(lastMessage.id)
    }),
    replacedChatPositionsChange(chatId, update.positions)
  ];
}

export function chatListMembershipAddedChanges(update: ChatAddedToListUpdate): DomainChange[] {
  return [
    {
      kind: 'chatListMembership.added',
      membership: {
        chatId: String(update.chat_id),
        chatList: tdJsonObject(update.chat_list),
        listKey: chatListKey(update.chat_list)
      }
    } satisfies ChatListMembershipAddedChange
  ];
}

export function chatListMembershipRemovedChanges(
  update: ChatRemovedFromListUpdate
): DomainChange[] {
  return [
    {
      kind: 'chatListMembership.removed',
      membership: {
        chatId: String(update.chat_id),
        listKey: chatListKey(update.chat_list)
      }
    } satisfies ChatListMembershipRemovedChange
  ];
}

export function chatMessageAutoDeleteTimeChanges(
  update: ChatMessageAutoDeleteTimeUpdate
): DomainChange[] {
  return updatedChatStateChanges({
    id: String(update.chat_id),
    messageAutoDeleteTime: update.message_auto_delete_time
  });
}

export function chatMessageSenderChanges(update: ChatMessageSenderUpdate): DomainChange[] {
  return updatedChatStateChanges({
    id: String(update.chat_id),
    messageSenderId: nullableJsonValue(update.message_sender_id)
  });
}

export function chatNotificationSettingsChanges(
  update: ChatNotificationSettingsUpdate
): DomainChange[] {
  return updatedChatStateChanges({
    id: String(update.chat_id),
    notificationSettings: tdJsonObject(update.notification_settings)
  });
}

export function chatPendingJoinRequestsChanges(
  update: ChatPendingJoinRequestsUpdate
): DomainChange[] {
  return updatedChatStateChanges({
    id: String(update.chat_id),
    pendingJoinRequests: nullableJsonValue(update.pending_join_requests)
  });
}

export function chatPermissionsChanges(update: ChatPermissionsUpdate): DomainChange[] {
  return updatedChatStateChanges({
    id: String(update.chat_id),
    permissions: nullableJsonValue(update.permissions)
  });
}

export function chatPositionChanges(update: ChatPositionUpdate): DomainChange[] {
  const chatId = String(update.chat_id);
  const position = chatPositionRecordFromTdlibPosition(chatId, update.position);
  if (position.order === '0') {
    return [
      {
        kind: 'chat.positionRemoved',
        position: {
          chatId,
          listKey: position.listKey
        }
      } satisfies ChatPositionRemovedChange
    ];
  }

  return [
    {
      kind: 'chat.positionUpserted',
      position
    } satisfies ChatPositionUpsertedChange
  ];
}

export function chatReadInboxChanges(update: ChatReadInboxUpdate): DomainChange[] {
  return updatedChatStateChanges({
    id: String(update.chat_id),
    lastReadInboxMessageId: tdId(update.last_read_inbox_message_id),
    unreadCount: update.unread_count
  });
}

export function chatReadOutboxChanges(update: ChatReadOutboxUpdate): DomainChange[] {
  return updatedChatStateChanges({
    id: String(update.chat_id),
    lastReadOutboxMessageId: tdId(update.last_read_outbox_message_id)
  });
}

export function chatReplyMarkupChanges(update: ChatReplyMarkupUpdate): DomainChange[] {
  const replyMarkupMessage = update.reply_markup_message ?? null;
  return [
    ...(replyMarkupMessage === null ? [] : savedMessageChanges(replyMarkupMessage)),
    ...updatedChatStateChanges({
      id: String(update.chat_id),
      replyMarkupMessageId: replyMarkupMessage === null ? null : String(replyMarkupMessage.id)
    })
  ];
}

export function chatTitleChanges(update: ChatTitleUpdate): DomainChange[] {
  return updatedChatStateChanges({
    id: String(update.chat_id),
    title: update.title
  });
}

export function chatUnreadMentionCountChanges(
  update: ChatUnreadMentionCountUpdate
): DomainChange[] {
  return updatedChatStateChanges({
    id: String(update.chat_id),
    unreadMentionCount: update.unread_mention_count
  });
}

export function chatUnreadPollVoteCountChanges(
  update: ChatUnreadPollVoteCountUpdate
): DomainChange[] {
  return updatedChatStateChanges({
    id: String(update.chat_id),
    unreadPollVoteCount: update.unread_poll_vote_count
  });
}

export function chatUnreadReactionCountChanges(
  update: ChatUnreadReactionCountUpdate
): DomainChange[] {
  return updatedChatStateChanges({
    id: String(update.chat_id),
    unreadReactionCount: update.unread_reaction_count
  });
}

export function chatVideoChatChanges(update: ChatVideoChatUpdate): DomainChange[] {
  return updatedChatStateChanges({
    id: String(update.chat_id),
    videoChat: nullableJsonValue(update.video_chat)
  });
}

export function chatViewAsTopicsChanges(update: ChatViewAsTopicsUpdate): DomainChange[] {
  return updatedChatStateChanges({
    id: String(update.chat_id),
    viewAsTopics: update.view_as_topics
  });
}

export function messageContainsUnreadPollVotesChanges(
  update: MessageContainsUnreadPollVotesUpdate
): DomainChange[] {
  return updatedChatStateChanges({
    id: String(update.chat_id),
    unreadPollVoteCount: update.unread_poll_vote_count
  });
}

export function messageMentionReadChatChanges(update: MessageMentionReadUpdate): DomainChange[] {
  return updatedChatStateChanges({
    id: String(update.chat_id),
    unreadMentionCount: update.unread_mention_count
  });
}

export function messageUnreadReactionsChatChanges(
  update: MessageUnreadReactionsUpdate
): DomainChange[] {
  return updatedChatStateChanges({
    id: String(update.chat_id),
    unreadReactionCount: update.unread_reaction_count
  });
}

export function chatStateFromTdlibChat(chat: TdlibChat): ChatState {
  const source = tdJsonObject(chat);
  const lastMessage = chat.last_message ?? null;
  return {
    accentColorId: chat.accent_color_id,
    actionBar: source.action_bar,
    availableReactions: source.available_reactions,
    background: source.background,
    backgroundCustomEmojiId: tdId(chat.background_custom_emoji_id),
    blockList: source.block_list,
    businessBotManageBar: source.business_bot_manage_bar,
    canBeDeletedForAllUsers: chat.can_be_deleted_for_all_users,
    canBeDeletedOnlyForSelf: chat.can_be_deleted_only_for_self,
    canBeReported: chat.can_be_reported,
    chatLists: source.chat_lists,
    clientData: chat.client_data,
    defaultDisableNotification: chat.default_disable_notification,
    draftMessage: source.draft_message,
    emojiStatus: source.emoji_status,
    hasProtectedContent: chat.has_protected_content,
    hasScheduledMessages: chat.has_scheduled_messages,
    id: String(chat.id),
    isMarkedAsUnread: chat.is_marked_as_unread,
    isTranslatable: chat.is_translatable,
    lastMessageChatId: lastMessage === null ? null : String(lastMessage.chat_id),
    lastMessageId: lastMessage === null ? null : String(lastMessage.id),
    lastReadInboxMessageId: tdId(chat.last_read_inbox_message_id),
    lastReadOutboxMessageId: tdId(chat.last_read_outbox_message_id),
    messageAutoDeleteTime: chat.message_auto_delete_time,
    messageSenderId: source.message_sender_id,
    notificationSettings: source.notification_settings,
    pendingJoinRequests: source.pending_join_requests,
    permissions: source.permissions,
    photo: source.photo,
    profileAccentColorId: chat.profile_accent_color_id,
    profileBackgroundCustomEmojiId: tdId(chat.profile_background_custom_emoji_id),
    replyMarkupMessageId: tdId(chat.reply_markup_message_id),
    theme: source.theme,
    title: chat.title,
    type: tdJsonObject(chat.type),
    unreadCount: chat.unread_count,
    unreadMentionCount: chat.unread_mention_count,
    unreadPollVoteCount: chat.unread_poll_vote_count,
    unreadReactionCount: chat.unread_reaction_count,
    upgradedGiftColors: source.upgraded_gift_colors,
    videoChat: source.video_chat,
    viewAsTopics: chat.view_as_topics
  };
}

function replacedChatPositionsChange(
  chatId: string,
  positions: readonly ChatPosition[]
): ChatPositionsReplacedChange {
  return {
    kind: 'chat.positionsReplaced',
    chatId,
    positions: chatPositionRecordsFromTdlibPositions(chatId, positions)
  };
}

function chatPositionRecordsFromTdlibPositions(
  chatId: string,
  positions: readonly ChatPosition[]
): ChatPositionState[] {
  const rows = new Map<string, ChatPositionState>();
  for (const position of positions) {
    const record = chatPositionRecordFromTdlibPosition(chatId, position);
    rows.set(record.listKey, record);
  }
  return [...rows.values()];
}

function chatPositionRecordFromTdlibPosition(
  chatId: string,
  position: ChatPosition
): ChatPositionState {
  return {
    chatId,
    isPinned: position.is_pinned,
    listKey: chatPositionListKey(position.list),
    order: position.order,
    source: tdJsonValue(position.source)
  };
}

function chatPositionListKey(list: ChatPosition['list']): string {
  return chatListKey(list);
}

function chatListKey(list: { _: string; chat_folder_id?: number | string }): string {
  if (list._ === 'chatListMain') {
    return 'main';
  }
  if (list._ === 'chatListArchive') {
    return 'archive';
  }
  if (list._ === 'chatListFolder' && list.chat_folder_id !== undefined) {
    return `folder:${String(list.chat_folder_id)}`;
  }
  throw new Error(`Unsupported chat list constructor: ${list._}`);
}

function nullableJsonValue(value: unknown): JsonValue {
  return tdJsonValue(value ?? null) ?? null;
}
