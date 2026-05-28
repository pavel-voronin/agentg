import { storeChatPosition } from '../../store/chat.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireChatPositionUpdate } from '../wire.js';

export async function handleUpdateChatPosition(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatPositionUpdate
): Promise<void> {
  await storeChatPosition(database, update);
  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
