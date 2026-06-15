import { and, eq, inArray } from 'drizzle-orm';

import { telegramBusinessMessages } from '../../database/schema.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type BusinessMessagesDeletedUpdate = UpdateByType<'updateBusinessMessagesDeleted'>;

export async function handleUpdateBusinessMessagesDeleted(
  update: BusinessMessagesDeletedUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const connectionId = update.connection_id;
  const chatId = String(update.chat_id);
  const messageIds = update.message_ids.map(String);

  await database
    .delete(telegramBusinessMessages)
    .where(
      and(
        eq(telegramBusinessMessages.connectionId, connectionId),
        eq(telegramBusinessMessages.messageChatId, chatId),
        inArray(telegramBusinessMessages.messageId, messageIds)
      )
    );
}
