import { replaceAttachmentMenuBots } from '../telegram-store/attachmentMenuBot.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireAttachmentMenuBotsUpdate = TelegramWireUpdateByType<'updateAttachmentMenuBots'>;

export async function handleUpdateAttachmentMenuBots(
  { database, events }: TelegramUpdateHandlerContext,
  { bots }: TelegramWireAttachmentMenuBotsUpdate
): Promise<void> {
  await replaceAttachmentMenuBots(database, bots);
  events.publishTelegramAttachmentMenuBotsUpdated();
}
