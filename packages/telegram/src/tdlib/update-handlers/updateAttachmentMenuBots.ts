import { replaceAttachmentMenuBots } from '../../store/attachmentMenuBot.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireAttachmentMenuBotsUpdate = TelegramWireUpdateByType<'updateAttachmentMenuBots'>;

export async function handleUpdateAttachmentMenuBots({
  bots
}: TelegramWireAttachmentMenuBotsUpdate): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await replaceAttachmentMenuBots(database, bots);
  events.publishTelegramAttachmentMenuBotsUpdated();
}
