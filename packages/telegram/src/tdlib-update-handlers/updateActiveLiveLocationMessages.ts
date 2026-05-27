import { replaceActiveLiveLocationMessageSet, storeMessage } from '../telegram-store/message.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireActiveLiveLocationMessagesUpdate =
  TelegramWireUpdateByType<'updateActiveLiveLocationMessages'>;

export async function handleUpdateActiveLiveLocationMessages(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireActiveLiveLocationMessagesUpdate
): Promise<void> {
  await database.transaction(async (transaction) => {
    for (const message of update.messages) {
      await storeMessage(transaction, message);
    }

    await replaceActiveLiveLocationMessageSet(transaction, update.messages);
  });
}
