import type { JsonValue } from '@agentg/framework';
import { and, eq, inArray } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import { QUICK_REPLY_MESSAGE_MODEL } from '../model/refs.js';
import {
  telegramFileSlots,
  telegramQuickReplyMessages,
  telegramQuickReplyShortcuts
} from '../database/schema.js';
import { tdId, tdJsonValue, type UpdateByType } from '../tdlib/value.js';

type QuickReplyShortcut = UpdateByType<'updateQuickReplyShortcut'>['shortcut'];
type QuickReplyMessage = UpdateByType<'updateQuickReplyShortcutMessages'>['messages'][number];

export async function upsertQuickReplyShortcut(
  database: Database,
  shortcut: QuickReplyShortcut
): Promise<void> {
  await database.transaction(async (transaction) => {
    const firstMessage = shortcut.first_message;
    const messageId = requiredId(firstMessage.id);
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
  database: Database,
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
            eq(telegramFileSlots.ownerModel, QUICK_REPLY_MESSAGE_MODEL),
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
  database: Database,
  input: {
    messages: QuickReplyMessage[];
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
            eq(telegramFileSlots.ownerModel, QUICK_REPLY_MESSAGE_MODEL),
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
  message: QuickReplyMessage,
  shortcutId: number,
  order: number
): typeof telegramQuickReplyMessages.$inferInsert {
  return {
    canBeEdited: message.can_be_edited,
    content: requiredJsonValue(message.content),
    id: requiredId(message.id),
    mediaAlbumId: zeroIdToNull(message.media_album_id),
    order,
    replyMarkup: requiredJsonValue(message.reply_markup ?? null),
    replyToMessageId: zeroIdToNull(message.reply_to_message_id),
    sendingState: requiredJsonValue(message.sending_state ?? null),
    shortcutId,
    viaBotUserId: requiredId(message.via_bot_user_id)
  };
}

function zeroIdToNull(value: number | string): string | null {
  return String(value) === '0' ? null : requiredId(value);
}

function requiredId(value: number | string): string {
  const id = tdId(value);
  if (id === undefined) {
    throw new Error('Expected Telegram wire id');
  }
  return id;
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
