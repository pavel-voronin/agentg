import { upsertQuickReplyShortcut } from '../../store/quickReply.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type QuickReplyShortcutUpdate = UpdateByType<'updateQuickReplyShortcut'>;

export async function handleUpdateQuickReplyShortcut(
  update: QuickReplyShortcutUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const { files } = resources;
  await upsertQuickReplyShortcut(database, update.shortcut);
  await files.recordQuickReplyMessageFiles(update.shortcut.first_message, 'live_update');
  await events.publishTelegramQuickReplyShortcutUpdated(update);
}
