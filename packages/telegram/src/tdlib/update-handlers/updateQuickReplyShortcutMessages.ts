import { replaceQuickReplyShortcutMessages } from '../../store/quickReply.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireQuickReplyShortcutMessagesUpdate =
  TelegramWireUpdateByType<'updateQuickReplyShortcutMessages'>;

export async function handleUpdateQuickReplyShortcutMessages(
  update: TelegramWireQuickReplyShortcutMessagesUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
  await replaceQuickReplyShortcutMessages(database, {
    messages: update.messages,
    shortcutId: update.shortcut_id
  });

  for (const message of update.messages) {
    await files.recordQuickReplyMessageFiles(message, 'live_update');
  }

  events.publishTelegramQuickReplyShortcutMessagesUpdated(update);
}
