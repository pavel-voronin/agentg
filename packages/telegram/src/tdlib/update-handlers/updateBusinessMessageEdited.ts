import { storeBusinessMessage } from '../../store/businessMessage.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type {
  TelegramWireMessage,
  TelegramWireMessageContentUpdate,
  TelegramWireUpdateByType
} from '../wire.js';

type TelegramWireBusinessMessageEditedUpdate =
  TelegramWireUpdateByType<'updateBusinessMessageEdited'>;

export async function handleUpdateBusinessMessageEdited(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireBusinessMessageEditedUpdate
): Promise<void> {
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
