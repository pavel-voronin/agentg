import { storeBusinessMessage } from '../../store/businessMessage.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';
import type {
  TelegramWireMessage,
  TelegramWireMessageContentUpdate,
  TelegramWireUpdateByType
} from '../wire.js';

type TelegramWireBusinessMessageEditedUpdate =
  TelegramWireUpdateByType<'updateBusinessMessageEdited'>;

export async function handleUpdateBusinessMessageEdited(
  update: TelegramWireBusinessMessageEditedUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
  await storeBusinessMessage(database, {
    businessMessage: update.message,
    connectionId: update.connection_id
  });

  await files.recordMessageFiles(update.message.message, 'live_update');

  const replyToMessage = update.message.reply_to_message ?? null;
  if (replyToMessage !== null) {
    await files.recordMessageFiles(replyToMessage, 'live_update');
  }

  events.publishTelegramMessageUpdated(messageContentUpdate(update.message.message));
}

function messageContentUpdate(message: TelegramWireMessage): TelegramWireMessageContentUpdate {
  return {
    _: 'updateMessageContent',
    chat_id: message.chat_id,
    message_id: message.id,
    new_content: message.content
  };
}
