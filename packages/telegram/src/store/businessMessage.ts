import { telegramBusinessMessages } from '../database/schema.js';
import type { Database } from '../database/client.js';
import { type UpdateByType } from '../tdlib/shape.js';
import { storeMessage } from './message.js';

type BusinessMessage = UpdateByType<'updateBusinessMessageEdited'>['message'];

export async function storeBusinessMessage(
  database: Database,
  input: {
    businessMessage: BusinessMessage;
    connectionId: string;
  }
): Promise<void> {
  const { businessMessage, connectionId } = input;
  const replyToMessage = businessMessage.reply_to_message ?? null;
  const row: typeof telegramBusinessMessages.$inferInsert = {
    connectionId,
    messageChatId: String(businessMessage.message.chat_id),
    messageId: String(businessMessage.message.id),
    replyToMessageChatId: replyToMessage === null ? null : String(replyToMessage.chat_id),
    replyToMessageId: replyToMessage === null ? null : String(replyToMessage.id)
  };

  await database.transaction(async (transaction) => {
    await storeMessage(transaction, businessMessage.message);

    if (replyToMessage !== null) {
      await storeMessage(transaction, replyToMessage);
    }

    await transaction
      .insert(telegramBusinessMessages)
      .values(row)
      .onConflictDoUpdate({
        set: row,
        target: [
          telegramBusinessMessages.connectionId,
          telegramBusinessMessages.messageChatId,
          telegramBusinessMessages.messageId
        ]
      });
  });
}
