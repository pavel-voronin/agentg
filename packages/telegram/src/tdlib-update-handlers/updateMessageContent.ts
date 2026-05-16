import { telegramMessages } from '../schema.js';
import {
  tdlibMessageContentServiceAction,
  tdlibMessageContentText,
  tdlibMessageContentTextEntities
} from '../tdlib-schema/Message.js';
import type { TdlibUpdateMessageContent } from '../tdlib-schema/UpdateMessageContent.js';
import type { TelegramUpdateHandlerContext } from './context.js';

export async function handleUpdateMessageContent(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TdlibUpdateMessageContent
): Promise<void> {
  const content = update.new_content;
  const text = tdlibMessageContentText(content);
  const textEntities = tdlibMessageContentTextEntities(content);
  const serviceAction = tdlibMessageContentServiceAction(content);

  await database
    .insert(telegramMessages)
    .values({
      chatId: update.chat_id,
      content,
      editDate: update.edit_date,
      id: update.message_id
    })
    .onConflictDoUpdate({
      set: {
        content,
        editDate: update.edit_date
      },
      target: [telegramMessages.chatId, telegramMessages.id]
    });

  await files.recordMessageContentFiles(update, 'live_update');

  events.publishTelegramMessageUpdated({
    chatId: update.chat_id,
    contentType: content._,
    messageId: update.message_id,
    textEntities,
    ...(text === undefined ? {} : { text }),
    ...(serviceAction === undefined ? {} : { serviceAction }),
    ...(update.edit_date === undefined ? {} : { editDate: update.edit_date })
  });
}
