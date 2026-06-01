import { telegramBusinessMessages } from '../../database/schema.js';
import type { Database } from '../../database/client.js';
import { recordMessageFiles, storeMessage } from '../../store/message.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type NewBusinessMessageUpdate = UpdateByType<'updateNewBusinessMessage'>;
type BusinessMessage = NewBusinessMessageUpdate['message'];

type StoreNewBusinessMessageResult = {
  businessMessageInserted: boolean;
  messageInserted: boolean;
};

export async function handleUpdateNewBusinessMessage(
  update: NewBusinessMessageUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const { files } = resources;
  const { recordLiveMessage } = resources.liveCoverage;
  const { businessMessageInserted, messageInserted } = await storeNewBusinessMessage(database, {
    businessMessage: update.message,
    connectionId: update.connection_id
  });
  const message = update.message.message;

  await recordMessageFiles(files, message, 'live_update');

  const replyToMessage = update.message.reply_to_message ?? null;
  if (replyToMessage !== null) {
    await recordMessageFiles(files, replyToMessage, 'live_update');
  }

  if (message.date > 0) {
    void recordLiveMessage(String(message.chat_id), new Date(message.date * 1000));
  }

  if (messageInserted || businessMessageInserted) {
    await events.publishTelegramMessageCreated(message);
  }
}

async function storeNewBusinessMessage(
  database: Database,
  input: {
    businessMessage: BusinessMessage;
    connectionId: string;
  }
): Promise<StoreNewBusinessMessageResult> {
  const { businessMessage, connectionId } = input;
  const replyToMessage = businessMessage.reply_to_message ?? null;
  const row: typeof telegramBusinessMessages.$inferInsert = {
    connectionId,
    messageChatId: String(businessMessage.message.chat_id),
    messageId: String(businessMessage.message.id),
    replyToMessageChatId: replyToMessage === null ? null : String(replyToMessage.chat_id),
    replyToMessageId: replyToMessage === null ? null : String(replyToMessage.id)
  };

  return database.transaction(async (transaction) => {
    const messageInserted = await storeMessage(transaction, businessMessage.message, 'ignore');

    if (!messageInserted) {
      await storeMessage(transaction, businessMessage.message);
    }

    if (replyToMessage !== null) {
      await storeMessage(transaction, replyToMessage);
    }

    const insertedBusinessRows = await transaction
      .insert(telegramBusinessMessages)
      .values(row)
      .onConflictDoNothing({
        target: [
          telegramBusinessMessages.connectionId,
          telegramBusinessMessages.messageChatId,
          telegramBusinessMessages.messageId
        ]
      })
      .returning({
        messageId: telegramBusinessMessages.messageId
      });
    const businessMessageInserted = insertedBusinessRows.length > 0;

    if (!businessMessageInserted) {
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
    }

    return {
      businessMessageInserted,
      messageInserted
    };
  });
}
