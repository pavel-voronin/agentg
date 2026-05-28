import { telegramBusinessMessages } from '../../schema.js';
import type { TelegramDatabase } from '../../database.js';
import { recordMessageFiles, storeMessage } from '../../store/message.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireNewBusinessMessageUpdate = TelegramWireUpdateByType<'updateNewBusinessMessage'>;
type TelegramWireBusinessMessage = TelegramWireNewBusinessMessageUpdate['message'];

type StoreNewBusinessMessageResult = {
  businessMessageInserted: boolean;
  messageInserted: boolean;
};

export async function handleUpdateNewBusinessMessage(
  { database, events, files, liveCoverageObserver }: TelegramUpdateHandlerContext,
  update: TelegramWireNewBusinessMessageUpdate
): Promise<void> {
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
    void liveCoverageObserver.recordLiveMessage(
      String(message.chat_id),
      new Date(message.date * 1000)
    );
  }

  if (messageInserted || businessMessageInserted) {
    events.publishTelegramMessageCreated(message);
  }
}

async function storeNewBusinessMessage(
  database: TelegramDatabase,
  input: {
    businessMessage: TelegramWireBusinessMessage;
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
