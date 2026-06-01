import { storeBusinessMessage } from '../../store/businessMessage.js';
import type { Message, MessageContentUpdate, UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type BusinessMessageEditedUpdate = UpdateByType<'updateBusinessMessageEdited'>;

export async function handleUpdateBusinessMessageEdited(
  update: BusinessMessageEditedUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const { files } = resources;
  await storeBusinessMessage(database, {
    businessMessage: update.message,
    connectionId: update.connection_id
  });

  await files.recordMessageFiles(update.message.message, 'live_update');

  const replyToMessage = update.message.reply_to_message ?? null;
  if (replyToMessage !== null) {
    await files.recordMessageFiles(replyToMessage, 'live_update');
  }

  await events.publishTelegramMessageUpdated(messageContentUpdate(update.message.message));
}

function messageContentUpdate(message: Message): MessageContentUpdate {
  return {
    _: 'updateMessageContent',
    chat_id: message.chat_id,
    message_id: message.id,
    new_content: message.content
  };
}
