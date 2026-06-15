import { and, eq } from 'drizzle-orm';

import { MESSAGE_MODEL, messageModelId } from '../../model/refs.js';
import { telegramFileSlots, telegramMessages } from '../../database/schema.js';
import { recordMessageFiles, storeMessage } from '../../store/message.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type MessageSendFailedUpdate = UpdateByType<'updateMessageSendFailed'>;

export async function handleUpdateMessageSendFailed(
  update: MessageSendFailedUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { files } = resources;
  const chatId = String(update.message.chat_id);
  const messageId = String(update.message.id);
  const oldMessageId = String(update.old_message_id);

  await database.transaction(async (transaction) => {
    await storeMessage(transaction, update.message);

    if (oldMessageId === messageId) {
      return;
    }

    await transaction
      .delete(telegramFileSlots)
      .where(
        and(
          eq(telegramFileSlots.ownerModel, MESSAGE_MODEL),
          eq(telegramFileSlots.ownerId, messageModelId(chatId, oldMessageId))
        )
      );

    await transaction
      .delete(telegramMessages)
      .where(and(eq(telegramMessages.chatId, chatId), eq(telegramMessages.id, oldMessageId)));
  });

  await recordMessageFiles(files, update.message, 'live_update');
}
