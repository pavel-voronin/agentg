import type { JsonObject, JsonValue } from '@agentg/events/json';
import { eq } from 'drizzle-orm';

import type { TelegramDatabase } from './database.js';
import { telegramChatPositions, telegramChats } from './schema.js';
import type { TdlibChat } from './tdlib-schema/Chat.js';
import type { TdlibUpdateChatLastMessage } from './tdlib-schema/UpdateChatLastMessage.js';

export async function persistTelegramChat(
  database: TelegramDatabase,
  chat: TdlibChat
): Promise<void> {
  const row = telegramChatRow(chat);
  await database.insert(telegramChats).values(row).onConflictDoUpdate({
    set: row,
    target: telegramChats.id
  });

  if (chat.positions !== undefined) {
    await replaceTelegramChatPositions(database, chat.id, chat.positions);
  }
}

export async function persistTelegramChatLastMessage(
  database: TelegramDatabase,
  update: TdlibUpdateChatLastMessage
): Promise<void> {
  const row: typeof telegramChats.$inferInsert = {
    id: update.chatId,
    lastMessageChatId: update.lastMessage?.chat_id ?? null,
    lastMessageId: update.lastMessage?.id ?? null
  };

  await database.insert(telegramChats).values(row).onConflictDoUpdate({
    set: row,
    target: telegramChats.id
  });

  if (update.positions !== undefined) {
    await replaceTelegramChatPositions(database, update.chatId, update.positions);
  }
}

export async function replaceTelegramChatPositions(
  database: TelegramDatabase,
  chatId: string,
  positions: JsonValue
): Promise<void> {
  await database.delete(telegramChatPositions).where(eq(telegramChatPositions.chatId, chatId));

  const rows = telegramChatPositionRows(chatId, positions);
  if (rows.length === 0) {
    return;
  }

  await database.insert(telegramChatPositions).values(rows);
}

function telegramChatRow(chat: TdlibChat): typeof telegramChats.$inferInsert {
  const source = chat.chat;
  return {
    accentColorId: numberField(source, 'accent_color_id'),
    actionBar: source.action_bar,
    availableReactions: source.available_reactions,
    background: source.background,
    backgroundCustomEmojiId: idString(source.background_custom_emoji_id),
    blockList: source.block_list,
    businessBotManageBar: source.business_bot_manage_bar,
    canBeDeletedForAllUsers: booleanField(source, 'can_be_deleted_for_all_users'),
    canBeDeletedOnlyForSelf: booleanField(source, 'can_be_deleted_only_for_self'),
    canBeReported: booleanField(source, 'can_be_reported'),
    chatLists: source.chat_lists,
    clientData: stringField(source, 'client_data'),
    defaultDisableNotification: booleanField(source, 'default_disable_notification'),
    draftMessage: source.draft_message,
    emojiStatus: source.emoji_status,
    hasProtectedContent: booleanField(source, 'has_protected_content'),
    hasScheduledMessages: booleanField(source, 'has_scheduled_messages'),
    id: chat.id,
    isMarkedAsUnread: chat.isMarkedAsUnread,
    isTranslatable: booleanField(source, 'is_translatable'),
    lastMessageChatId: chat.lastMessage?.chat_id ?? null,
    lastMessageId: chat.lastMessage?.id ?? null,
    lastReadInboxMessageId: chat.lastReadInboxMessageId,
    lastReadOutboxMessageId: chat.lastReadOutboxMessageId,
    messageAutoDeleteTime: numberField(source, 'message_auto_delete_time'),
    messageSenderId: source.message_sender_id,
    notificationSettings: chat.notificationSettings,
    pendingJoinRequests: source.pending_join_requests,
    permissions: source.permissions,
    photo: chat.photo,
    profileAccentColorId: numberField(source, 'profile_accent_color_id'),
    profileBackgroundCustomEmojiId: idString(source.profile_background_custom_emoji_id),
    replyMarkupMessageId: idString(source.reply_markup_message_id),
    theme: source.theme,
    title: chat.title,
    type: chat.typeObject,
    unreadCount: chat.unreadCount,
    unreadMentionCount: numberField(source, 'unread_mention_count'),
    unreadPollVoteCount: numberField(source, 'unread_poll_vote_count'),
    unreadReactionCount: numberField(source, 'unread_reaction_count'),
    upgradedGiftColors: source.upgraded_gift_colors,
    videoChat: source.video_chat,
    viewAsTopics: booleanField(source, 'view_as_topics')
  };
}

function telegramChatPositionRows(
  chatId: string,
  positions: JsonValue
): (typeof telegramChatPositions.$inferInsert)[] {
  if (!Array.isArray(positions)) {
    return [];
  }

  return positions.flatMap((position) => {
    const record = recordValue(position);
    const listKey = chatPositionListKey(recordValue(record?.list));
    const order = idString(record?.order);
    if (listKey === undefined || order === undefined) {
      return [];
    }

    return [
      {
        chatId,
        isPinned: record?.is_pinned === true || record?.isPinned === true,
        listKey,
        order,
        source: record?.source
      }
    ];
  });
}

function chatPositionListKey(list: Record<string, JsonValue> | undefined): string | undefined {
  if (list?._ === 'chatListMain') {
    return 'main';
  }
  if (list?._ === 'chatListArchive') {
    return 'archive';
  }
  if (list?._ !== 'chatListFolder') {
    return undefined;
  }

  const folderId = idString(list.chat_folder_id ?? list.chatFolderId);
  return folderId === undefined ? undefined : `folder:${folderId}`;
}

function booleanField(source: JsonObject, name: string): boolean | undefined {
  const value = source[name];
  return typeof value === 'boolean' ? value : undefined;
}

function numberField(source: JsonObject, name: string): number | undefined {
  const value = source[name];
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function stringField(source: JsonObject, name: string): string | undefined {
  const value = source[name];
  return typeof value === 'string' ? value : undefined;
}

function idString(value: JsonValue | undefined): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return String(value);
  }
  return undefined;
}

function recordValue(value: JsonValue | undefined): JsonObject | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : undefined;
}
