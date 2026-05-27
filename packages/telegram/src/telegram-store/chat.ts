import { and, eq } from 'drizzle-orm';

import type { TelegramDatabase } from '../database.js';
import { telegramChatPositions, telegramChats } from '../schema.js';
import type { TelegramFileSubsystem } from '../telegramFileSubsystem.js';
import type { TelegramMediaDownloadPolicyCause } from '../telegramFilePolicy.js';
import {
  telegramWireId,
  telegramWireJsonObject,
  telegramWireJsonValue,
  type TelegramWireChat,
  type TelegramWireChatLastMessageUpdate,
  type TelegramWireChatNotificationSettingsUpdate,
  type TelegramWireChatPositionUpdate,
  type TelegramWireMessage,
  type TelegramWireObject
} from '../telegramWire.js';

type TelegramWireChatPosition = TelegramWireChat['positions'][number];

export type TelegramChatFragment = typeof telegramChats.$inferInsert;

export async function storeChat(database: TelegramDatabase, chat: TelegramWireChat): Promise<void> {
  const row = telegramChatRow(chat);
  await database.insert(telegramChats).values(row).onConflictDoUpdate({
    set: row,
    target: telegramChats.id
  });

  await replaceTelegramChatPositions(database, String(chat.id), chat.positions);
}

export async function upsertTelegramChatFragment(
  database: TelegramDatabase,
  row: TelegramChatFragment
): Promise<void> {
  await database.insert(telegramChats).values(row).onConflictDoUpdate({
    set: row,
    target: telegramChats.id
  });
}

export async function storeChatLastMessage(
  database: TelegramDatabase,
  update: TelegramWireChatLastMessageUpdate
): Promise<void> {
  const lastMessage = update.last_message ?? null;
  const row: typeof telegramChats.$inferInsert = {
    id: String(update.chat_id),
    lastMessageChatId: lastMessage === null ? null : String(lastMessage.chat_id),
    lastMessageId: lastMessage === null ? null : String(lastMessage.id)
  };

  await database.insert(telegramChats).values(row).onConflictDoUpdate({
    set: row,
    target: telegramChats.id
  });

  await replaceTelegramChatPositions(database, String(update.chat_id), update.positions);
}

export async function storeChatNotificationSettings(
  database: TelegramDatabase,
  update: TelegramWireChatNotificationSettingsUpdate
): Promise<void> {
  const row: typeof telegramChats.$inferInsert = {
    id: String(update.chat_id),
    notificationSettings: telegramWireJsonObject(update.notification_settings)
  };

  await database.insert(telegramChats).values(row).onConflictDoUpdate({
    set: row,
    target: telegramChats.id
  });
}

export async function storeChatPosition(
  database: TelegramDatabase,
  update: TelegramWireChatPositionUpdate
): Promise<void> {
  const row = telegramChatPositionRow(String(update.chat_id), update.position);

  if (update.position.order === '0') {
    await database
      .delete(telegramChatPositions)
      .where(
        and(
          eq(telegramChatPositions.chatId, row.chatId),
          eq(telegramChatPositions.listKey, row.listKey)
        )
      );
    return;
  }

  await database
    .insert(telegramChatPositions)
    .values(row)
    .onConflictDoUpdate({
      set: row,
      target: [telegramChatPositions.chatId, telegramChatPositions.listKey]
    });
}

export function recordChatFiles(
  files: TelegramFileSubsystem,
  chat: TelegramWireChat,
  cause: TelegramMediaDownloadPolicyCause
): Promise<void> {
  return files.recordChatFiles(chat, cause);
}

export async function replaceTelegramChatPositions(
  database: TelegramDatabase,
  chatId: string,
  positions: TelegramWireChat['positions']
): Promise<void> {
  await database.delete(telegramChatPositions).where(eq(telegramChatPositions.chatId, chatId));

  const rows = telegramChatPositionRows(chatId, positions);
  if (rows.length === 0) {
    return;
  }

  await database.insert(telegramChatPositions).values(rows);
}

function telegramChatRow(chat: TelegramWireChat): typeof telegramChats.$inferInsert {
  const source = telegramWireJsonObject(chat);
  const lastMessage = chat.last_message ?? null;
  return {
    accentColorId: chat.accent_color_id,
    actionBar: source.action_bar,
    availableReactions: source.available_reactions,
    background: source.background,
    backgroundCustomEmojiId: telegramWireId(chat.background_custom_emoji_id),
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
    lastReadInboxMessageId: telegramWireId(chat.last_read_inbox_message_id),
    lastReadOutboxMessageId: telegramWireId(chat.last_read_outbox_message_id),
    messageAutoDeleteTime: chat.message_auto_delete_time,
    messageSenderId: source.message_sender_id,
    notificationSettings: source.notification_settings,
    pendingJoinRequests: source.pending_join_requests,
    permissions: source.permissions,
    photo: source.photo,
    profileAccentColorId: chat.profile_accent_color_id,
    profileBackgroundCustomEmojiId: telegramWireId(chat.profile_background_custom_emoji_id),
    replyMarkupMessageId: telegramWireId(chat.reply_markup_message_id),
    theme: source.theme,
    title: chat.title,
    type: telegramWireJsonObject(chat.type),
    unreadCount: chat.unread_count,
    unreadMentionCount: chat.unread_mention_count,
    unreadPollVoteCount: chat.unread_poll_vote_count,
    unreadReactionCount: chat.unread_reaction_count,
    upgradedGiftColors: source.upgraded_gift_colors,
    videoChat: source.video_chat,
    viewAsTopics: chat.view_as_topics
  };
}

function telegramChatPositionRows(
  chatId: string,
  positions: TelegramWireChat['positions']
): (typeof telegramChatPositions.$inferInsert)[] {
  return positions.map((position) => telegramChatPositionRow(chatId, position));
}

function telegramChatPositionRow(
  chatId: string,
  position: TelegramWireChatPosition
): typeof telegramChatPositions.$inferInsert {
  const listKey = chatPositionListKey(position.list);

  return {
    chatId,
    isPinned: position.is_pinned,
    listKey,
    order: position.order,
    source: telegramWireJsonValue(position.source)
  };
}

function chatPositionListKey(list: TelegramWireChatPosition['list']): string {
  if (list._ === 'chatListMain') {
    return 'main';
  }
  if (list._ === 'chatListArchive') {
    return 'archive';
  }

  return `folder:${String(list.chat_folder_id)}`;
}

export function telegramChatLastMessage(chat: TelegramWireChat): TelegramWireMessage | null {
  return chat.last_message ?? null;
}

export function telegramChatType(chat: TelegramWireChat): string {
  const value = chat.type as TelegramWireObject;
  if (value._ === 'chatTypePrivate') {
    return 'private';
  }
  if (value._ === 'chatTypeSecret') {
    return 'secret';
  }
  if (value._ === 'chatTypeBasicGroup') {
    return 'group';
  }
  if (value._ === 'chatTypeSupergroup') {
    return value.is_channel === true ? 'channel' : 'group';
  }
  return value._;
}
