import { and, eq, inArray } from 'drizzle-orm';

import { TELEGRAM_MESSAGE_MODEL, telegramMessageModelId } from '../model-refs.js';
import { telegramFileSlots, telegramMessageReactions, telegramMessages } from '../schema.js';
import type { TdlibUpdateDeleteMessages } from '../tdlib-schema/UpdateDeleteMessages.js';
import type { TelegramUpdateHandlerContext } from './context.js';

export async function handleUpdateDeleteMessages(
  { database, events }: TelegramUpdateHandlerContext,
  update: TdlibUpdateDeleteMessages
): Promise<void> {
  if (update.from_cache || !update.is_permanent) {
    return;
  }

  const deletedAt = new Date();
  await database.transaction(async (transaction) => {
    await transaction.delete(telegramFileSlots).where(
      and(
        eq(telegramFileSlots.ownerModel, TELEGRAM_MESSAGE_MODEL),
        inArray(
          telegramFileSlots.ownerId,
          update.message_ids.map((messageId) => telegramMessageModelId(update.chat_id, messageId))
        )
      )
    );

    await transaction
      .delete(telegramMessageReactions)
      .where(
        and(
          eq(telegramMessageReactions.chatId, update.chat_id),
          inArray(telegramMessageReactions.messageId, update.message_ids)
        )
      );
    await transaction
      .delete(telegramMessages)
      .where(
        and(
          eq(telegramMessages.chatId, update.chat_id),
          inArray(telegramMessages.id, update.message_ids)
        )
      );
  });

  events.publishTelegramMessageDeleted({
    chatId: update.chat_id,
    deletedAt,
    fromCache: update.from_cache,
    isPermanent: update.is_permanent,
    messageIds: update.message_ids
  });
}
