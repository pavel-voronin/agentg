import { messageSenderId, messageText, messageTextEntities } from '../tdlib-schema/Message.js';
import type { TdlibUpdateNewMessage } from '../tdlib-schema/UpdateNewMessage.js';
import { persistTelegramMessage } from '../telegram-message-persistence.js';
import type { TelegramUpdateHandlerContext } from './context.js';

export async function handleUpdateNewMessage(
  { database, files, liveCoverageObserver, events }: TelegramUpdateHandlerContext,
  { message }: TdlibUpdateNewMessage
): Promise<void> {
  const messageDate = message.date;
  const contentType = message.content._;
  const senderId = messageSenderId(message);
  const senderType = message.sender_id?._;
  const text = messageText(message);
  const textEntities = messageTextEntities(message);

  if (!(await persistTelegramMessage(database, message, 'ignore'))) {
    return;
  }

  await files.recordMessageFiles(message, 'live_update');

  if (messageDate !== undefined) {
    void liveCoverageObserver.recordLiveMessage(message.chat_id, messageDate);
  }

  events.publishTelegramMessageCreated({
    chatId: message.chat_id,
    contentType,
    isOutgoing: message.is_outgoing ?? false,
    messageId: message.id,
    textEntities,
    ...(messageDate === undefined ? {} : { messageDate }),
    ...(senderId === undefined ? {} : { senderId }),
    ...(senderType === undefined ? {} : { senderType }),
    ...(text === undefined ? {} : { text })
  });
}
