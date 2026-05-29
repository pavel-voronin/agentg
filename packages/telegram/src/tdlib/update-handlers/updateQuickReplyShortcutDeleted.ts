import { deleteQuickReplyShortcut } from '../../store/quickReply.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireQuickReplyShortcutDeletedUpdate =
  TelegramWireUpdateByType<'updateQuickReplyShortcutDeleted'>;

export async function handleUpdateQuickReplyShortcutDeleted(
  update: TelegramWireQuickReplyShortcutDeletedUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await deleteQuickReplyShortcut(database, update.shortcut_id);
  events.publishTelegramQuickReplyShortcutDeleted(update);
}
