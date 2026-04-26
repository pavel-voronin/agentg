import type { AppDatabase } from '@agentg/database/client';
import {
  telegramChats,
  telegramEvents,
  telegramMessages,
  telegramUsers
} from '@agentg/database/schema';
import { sql } from 'drizzle-orm';

import type {
  NormalizedTelegramChat,
  NormalizedTelegramMessageContentUpdate,
  NormalizedTelegramMessageDelete,
  NormalizedTelegramMessage,
  NormalizedTelegramUpdate,
  NormalizedTelegramUser,
  RawTelegramEvent
} from './normalize.js';

export type TelegramPersistResult = {
  chat: boolean;
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
    event: update.event === undefined ? false : await insertRawEvent(database, update.event),
    message:
      (update.message !== undefined && (await upsertMessage(database, update.message))) ||
      (update.contentUpdate !== undefined &&
        (await updateMessageContent(database, update.contentUpdate))) ||
      (update.delete !== undefined && (await markMessagesDeleted(database, update.delete))),
    user: update.user === undefined ? false : await upsertUser(database, update.user)
  };
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

  return upserted.length === 1;
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
      lastName: user.lastName,
      raw: user.raw,
      telegramUserId: user.id,
      username: user.username
    })
    .onConflictDoUpdate({
      set: {
        firstName: user.firstName,
        isBot: user.isBot,
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
