import { upsertQuickReplyShortcut } from '../../store/quickReply.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireQuickReplyShortcutUpdate = TelegramWireUpdateByType<'updateQuickReplyShortcut'>;

export async function handleUpdateQuickReplyShortcut(
  update: TelegramWireQuickReplyShortcutUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
  await upsertQuickReplyShortcut(database, update.shortcut);
  await files.recordQuickReplyMessageFiles(update.shortcut.first_message, 'live_update');
  events.publishTelegramQuickReplyShortcutUpdated(update);
}
