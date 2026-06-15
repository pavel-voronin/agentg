import { and, eq, inArray } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import {
  telegramFileSlots,
  telegramQuickReplyMessages,
  telegramQuickReplyShortcuts
} from '../database/schema.js';
import type { QuickReplyMessageState, QuickReplyShortcut } from '../domain/models/quickReply.js';
import { QUICK_REPLY_MESSAGE_MODEL } from '../model/refs.js';

export async function saveQuickReplyShortcuts(
  database: Database,
  input: {
    firstMessage: QuickReplyMessageState;
    shortcut: QuickReplyShortcut;
  }
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction
      .insert(telegramQuickReplyMessages)
      .values(input.firstMessage)
      .onConflictDoUpdate({
        set: input.firstMessage,
        target: telegramQuickReplyMessages.id
      });

    await transaction
      .insert(telegramQuickReplyShortcuts)
      .values(input.shortcut)
      .onConflictDoUpdate({
        set: input.shortcut,
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
      .select({ id: telegramQuickReplyMessages.id })
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

export async function replaceQuickReplyMessageStates(
  database: Database,
  input: {
    messages: readonly QuickReplyMessageState[];
    shortcutId: number;
  }
): Promise<void> {
  await database.transaction(async (transaction) => {
    const currentMessages = await transaction
      .select({ id: telegramQuickReplyMessages.id })
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

    if (input.messages.length > 0) {
      await transaction.insert(telegramQuickReplyMessages).values([...input.messages]);
    }
  });
}
