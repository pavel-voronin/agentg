import type { AppDatabase } from '@agentg/database/client';
import {
  telegramChatFolders,
  telegramChats,
  telegramEvents,
  telegramMessages,
  telegramUsers
} from '@agentg/database/schema';
import { eq, notInArray, sql } from 'drizzle-orm';

import type {
  NormalizedTelegramChat,
  NormalizedTelegramChatFolders,
  NormalizedTelegramMessageContentUpdate,
  NormalizedTelegramMessageDelete,
  NormalizedTelegramMessage,
  NormalizedTelegramUpdate,
  NormalizedTelegramUser,
  RawTelegramEvent
} from './normalize.js';

export type TelegramPersistResult = {
  chat: boolean;
  chatFolders: boolean;
  event: boolean;
  message: boolean;
  user: boolean;
};

export async function persistTelegramUpdate(
  database: AppDatabase,
  update: NormalizedTelegramUpdate
): Promise<TelegramPersistResult> {
  return {
    chat: update.chat === undefined ? false : await upsertChat(database, update.chat),
    chatFolders:
      update.chatFolders === undefined
        ? false
        : await replaceChatFolders(database, update.chatFolders),
    event: update.event === undefined ? false : await insertRawEvent(database, update.event),
    message:
      (update.message !== undefined && (await upsertMessage(database, update.message))) ||
      (update.contentUpdate !== undefined &&
        (await updateMessageContent(database, update.contentUpdate))) ||
      (update.delete !== undefined && (await markMessagesDeleted(database, update.delete))),
    user: update.user === undefined ? false : await upsertUser(database, update.user)
  };
}

export async function replaceChatFolders(
  database: AppDatabase,
  update: NormalizedTelegramChatFolders
): Promise<boolean> {
  await database.transaction(async (transaction) => {
    const folderIds = update.folders.map((folder) => folder.id);

    if (folderIds.length === 0) {
      await transaction.delete(telegramChatFolders);
      return;
    }

    await transaction
      .delete(telegramChatFolders)
      .where(notInArray(telegramChatFolders.telegramChatFolderId, folderIds));

    for (const folder of update.folders) {
      await transaction
        .insert(telegramChatFolders)
        .values({
          iconName: folder.iconName,
          position: folder.position,
          raw: folder.raw,
          telegramChatFolderId: folder.id,
          title: folder.title
        })
        .onConflictDoUpdate({
          set: {
            iconName: folder.iconName,
            position: folder.position,
            raw: folder.raw,
            title: folder.title,
            updatedAt: sql`now()`
          },
          target: telegramChatFolders.telegramChatFolderId
        });
    }
  });

  return true;
}

export async function updateMessageContent(
  database: AppDatabase,
  update: NormalizedTelegramMessageContentUpdate
): Promise<boolean> {
  const updated = await database
    .update(telegramMessages)
    .set({
      contentType: update.contentType,
      editDate: update.editDate,
      isDeleted: false,
      raw: update.raw,
      text: update.text,
      updatedAt: sql`now()`
    })
    .where(
      sql`${telegramMessages.telegramChatId} = ${update.chatId} and ${telegramMessages.telegramMessageId} = ${update.messageId}`
    )
    .returning({
      telegramMessageId: telegramMessages.telegramMessageId
    });

  return updated.length === 1;
}

export async function markMessagesDeleted(
  database: AppDatabase,
  update: NormalizedTelegramMessageDelete
): Promise<boolean> {
  if (update.fromCache || !update.isPermanent) {
    return false;
  }

  const updated = await database
    .update(telegramMessages)
    .set({
      deletedAt: update.deletedAt,
      isDeleted: true,
      updatedAt: sql`now()`
    })
    .where(
      sql`${telegramMessages.telegramChatId} = ${update.chatId} and ${telegramMessages.telegramMessageId} in ${update.messageIds}`
    )
    .returning({
      telegramMessageId: telegramMessages.telegramMessageId
    });

  return updated.length > 0;
}

export async function insertRawEvent(
  database: AppDatabase,
  event: RawTelegramEvent
): Promise<boolean> {
  const inserted = await database
    .insert(telegramEvents)
    .values({
      eventKey: event.eventKey,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      payload: event.payload,
      payloadHash: event.payloadHash,
      tdlibUpdateType: event.tdlibUpdateType,
      telegramChatId: event.telegramChatId,
      telegramMessageId: event.telegramMessageId
    })
    .onConflictDoNothing({
      target: telegramEvents.eventKey
    })
    .returning({
      id: telegramEvents.id
    });

  return inserted.length === 1;
}

export async function upsertChat(
  database: AppDatabase,
  chat: NormalizedTelegramChat
): Promise<boolean> {
  const [existing] = await database
    .select({
      title: telegramChats.title,
      type: telegramChats.type
    })
    .from(telegramChats)
    .where(eq(telegramChats.telegramChatId, chat.id))
    .limit(1);

  const upserted = await database
    .insert(telegramChats)
    .values({
      raw: chat.raw,
      telegramChatId: chat.id,
      title: chat.title,
      type: chat.type
    })
    .onConflictDoUpdate({
      set: {
        raw: chat.raw,
        title: chat.title,
        type: chat.type,
        updatedAt: sql`now()`
      },
      target: telegramChats.telegramChatId
    })
    .returning({
      telegramChatId: telegramChats.telegramChatId
    });

  const materiallyChanged =
    existing === undefined ? true : existing.title !== chat.title || existing.type !== chat.type;

  return upserted.length === 1 && materiallyChanged;
}

export async function upsertUser(
  database: AppDatabase,
  user: NormalizedTelegramUser
): Promise<boolean> {
  const upserted = await database
    .insert(telegramUsers)
    .values({
      firstName: user.firstName,
      isBot: user.isBot,
      ...(user.isSelf === true ? { isSelf: true } : {}),
      lastName: user.lastName,
      raw: user.raw,
      telegramUserId: user.id,
      username: user.username
    })
    .onConflictDoUpdate({
      set: {
        firstName: user.firstName,
        isBot: user.isBot,
        ...(user.isSelf === true ? { isSelf: true } : {}),
        lastName: user.lastName,
        raw: user.raw,
        updatedAt: sql`now()`,
        username: user.username
      },
      target: telegramUsers.telegramUserId
    })
    .returning({
      telegramUserId: telegramUsers.telegramUserId
    });

  return upserted.length === 1;
}

export async function persistCurrentTelegramUser(
  database: AppDatabase,
  user: NormalizedTelegramUser
): Promise<boolean> {
  await database
    .update(telegramUsers)
    .set({
      isSelf: false,
      updatedAt: sql`now()`
    })
    .where(sql`${telegramUsers.isSelf} = true and ${telegramUsers.telegramUserId} <> ${user.id}`);

  return upsertUser(database, {
    ...user,
    isSelf: true
  });
}

export async function upsertMessage(
  database: AppDatabase,
  message: NormalizedTelegramMessage
): Promise<boolean> {
  const upserted = await database
    .insert(telegramMessages)
    .values({
      contentType: message.contentType,
      isDeleted: false,
      editDate: message.editDate,
      messageDate: message.messageDate,
      raw: message.raw,
      senderId: message.senderId,
      senderType: message.senderType,
      telegramChatId: message.chatId,
      telegramMessageId: message.messageId,
      text: message.text
    })
    .onConflictDoUpdate({
      set: {
        contentType: message.contentType,
        isDeleted: false,
        editDate: message.editDate,
        messageDate: message.messageDate,
        raw: message.raw,
        senderId: message.senderId,
        senderType: message.senderType,
        text: message.text,
        updatedAt: sql`now()`
      },
      target: [telegramMessages.telegramChatId, telegramMessages.telegramMessageId]
    })
    .returning({
      telegramMessageId: telegramMessages.telegramMessageId
    });

  return upserted.length === 1;
}
