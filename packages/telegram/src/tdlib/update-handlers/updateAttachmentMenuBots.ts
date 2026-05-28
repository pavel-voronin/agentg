import { replaceAttachmentMenuBots } from '../../store/attachmentMenuBot.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireAttachmentMenuBotsUpdate = TelegramWireUpdateByType<'updateAttachmentMenuBots'>;

export async function handleUpdateAttachmentMenuBots(
  { database, events }: TelegramUpdateHandlerContext,
  { bots }: TelegramWireAttachmentMenuBotsUpdate
): Promise<void> {
  await replaceAttachmentMenuBots(database, bots);
  events.publishTelegramAttachmentMenuBotsUpdated();
}
