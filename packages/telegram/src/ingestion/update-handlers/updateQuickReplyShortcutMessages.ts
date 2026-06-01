import { replaceQuickReplyShortcutMessages } from '../../store/quickReply.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type QuickReplyShortcutMessagesUpdate = UpdateByType<'updateQuickReplyShortcutMessages'>;

export async function handleUpdateQuickReplyShortcutMessages(
  update: QuickReplyShortcutMessagesUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const { files } = resources;
  await replaceQuickReplyShortcutMessages(database, {
    messages: update.messages,
    shortcutId: update.shortcut_id
  });

  for (const message of update.messages) {
    await files.recordQuickReplyMessageFiles(message, 'live_update');
  }

  await events.publishTelegramQuickReplyShortcutMessagesUpdated(update);
}
