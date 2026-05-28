import { and, eq, inArray } from 'drizzle-orm';

import { telegramBusinessMessages } from '../../database/schema.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireBusinessMessagesDeletedUpdate =
  TelegramWireUpdateByType<'updateBusinessMessagesDeleted'>;

export async function handleUpdateBusinessMessagesDeleted(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireBusinessMessagesDeletedUpdate
): Promise<void> {
  const connectionId = update.connection_id;
  const chatId = String(update.chat_id);
  const messageIds = update.message_ids.map(String);
  const deletedAt = new Date();

  await database
    .delete(telegramBusinessMessages)
    .where(
      and(
        eq(telegramBusinessMessages.connectionId, connectionId),
        eq(telegramBusinessMessages.messageChatId, chatId),
        inArray(telegramBusinessMessages.messageId, messageIds)
      )
    );

  events.publishTelegramBusinessMessagesDeleted({
    chatId,
    connectionId,
    deletedAt: deletedAt.toISOString(),
    messageIds
  });
}
