import type { JsonValue } from '@agentg/events/json';
import { and, eq, inArray } from 'drizzle-orm';

import type { TelegramDatabase } from '../database.js';
import { TELEGRAM_QUICK_REPLY_MESSAGE_MODEL } from '../modelRefs.js';
import {
  telegramFileSlots,
  telegramQuickReplyMessages,
  telegramQuickReplyShortcuts
} from '../schema.js';
import {
  telegramWireId,
  telegramWireJsonValue,
  type TelegramWireUpdateByType
} from '../tdlib/wire.js';

type TelegramWireQuickReplyShortcut =
  TelegramWireUpdateByType<'updateQuickReplyShortcut'>['shortcut'];
type TelegramWireQuickReplyMessage =
  TelegramWireUpdateByType<'updateQuickReplyShortcutMessages'>['messages'][number];

export async function upsertQuickReplyShortcut(
  database: TelegramDatabase,
  shortcut: TelegramWireQuickReplyShortcut
): Promise<void> {
  await database.transaction(async (transaction) => {
    const firstMessage = shortcut.first_message;
    const messageId = requiredTelegramWireId(firstMessage.id);
    const messageRow = quickReplyMessageRow(firstMessage, shortcut.id, 0);

    await transaction.insert(telegramQuickReplyMessages).values(messageRow).onConflictDoUpdate({
      set: messageRow,
      target: telegramQuickReplyMessages.id
    });

    const shortcutRow: typeof telegramQuickReplyShortcuts.$inferInsert = {
      firstMessageId: messageId,
      id: shortcut.id,
      messageCount: shortcut.message_count,
      name: shortcut.name
    };

    await transaction.insert(telegramQuickReplyShortcuts).values(shortcutRow).onConflictDoUpdate({
      set: shortcutRow,
      target: telegramQuickReplyShortcuts.id
    });
  });
}

export async function deleteQuickReplyShortcut(
  database: TelegramDatabase,
  shortcutId: number
): Promise<void> {
  await database.transaction(async (transaction) => {
    const messages = await transaction
      .select({
        id: telegramQuickReplyMessages.id
      })
      .from(telegramQuickReplyMessages)
      .where(eq(telegramQuickReplyMessages.shortcutId, shortcutId));
    const messageIds = messages.map((message) => message.id);

    if (messageIds.length > 0) {
      await transaction
        .delete(telegramFileSlots)
        .where(
          and(
            eq(telegramFileSlots.ownerModel, TELEGRAM_QUICK_REPLY_MESSAGE_MODEL),
            inArray(telegramFileSlots.ownerId, messageIds)
          )
        );
    }

    await transaction
      .delete(telegramQuickReplyShortcuts)
      .where(eq(telegramQuickReplyShortcuts.id, shortcutId));
    await transaction
      .delete(telegramQuickReplyMessages)
      .where(eq(telegramQuickReplyMessages.shortcutId, shortcutId));
  });
}

export async function replaceQuickReplyShortcutMessages(
  database: TelegramDatabase,
  input: {
    messages: TelegramWireQuickReplyMessage[];
    shortcutId: number;
  }
): Promise<void> {
  await database.transaction(async (transaction) => {
    const currentMessages = await transaction
      .select({
        id: telegramQuickReplyMessages.id
      })
      .from(telegramQuickReplyMessages)
      .where(eq(telegramQuickReplyMessages.shortcutId, input.shortcutId));
    const currentMessageIds = currentMessages.map((message) => message.id);

    if (currentMessageIds.length > 0) {
      await transaction
        .delete(telegramFileSlots)
        .where(
          and(
            eq(telegramFileSlots.ownerModel, TELEGRAM_QUICK_REPLY_MESSAGE_MODEL),
            inArray(telegramFileSlots.ownerId, currentMessageIds)
          )
        );
    }

    await transaction
      .delete(telegramQuickReplyMessages)
      .where(eq(telegramQuickReplyMessages.shortcutId, input.shortcutId));

    const rows = input.messages.map((message, order) =>
      quickReplyMessageRow(message, input.shortcutId, order)
    );

    if (rows.length > 0) {
      await transaction.insert(telegramQuickReplyMessages).values(rows);
    }
  });
}

export function quickReplyMessageRow(
  message: TelegramWireQuickReplyMessage,
  shortcutId: number,
  order: number
): typeof telegramQuickReplyMessages.$inferInsert {
  return {
    canBeEdited: message.can_be_edited,
    content: requiredTelegramWireJsonValue(message.content),
    id: requiredTelegramWireId(message.id),
    mediaAlbumId: zeroIdToNull(message.media_album_id),
    order,
    replyMarkup: requiredTelegramWireJsonValue(message.reply_markup ?? null),
    replyToMessageId: zeroIdToNull(message.reply_to_message_id),
    sendingState: requiredTelegramWireJsonValue(message.sending_state ?? null),
    shortcutId,
    viaBotUserId: requiredTelegramWireId(message.via_bot_user_id)
  };
}

function zeroIdToNull(value: number | string): string | null {
  return String(value) === '0' ? null : requiredTelegramWireId(value);
}

function requiredTelegramWireId(value: number | string): string {
  const id = telegramWireId(value);
  if (id === undefined) {
    throw new Error('Expected Telegram wire id');
  }
  return id;
}

function requiredTelegramWireJsonValue(value: unknown): JsonValue {
  const json = telegramWireJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
