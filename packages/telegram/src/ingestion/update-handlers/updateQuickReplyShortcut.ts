import { upsertQuickReplyShortcut } from '../../store/quickReply.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type QuickReplyShortcutUpdate = UpdateByType<'updateQuickReplyShortcut'>;

export async function handleUpdateQuickReplyShortcut(
  update: QuickReplyShortcutUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { files } = resources;
  await upsertQuickReplyShortcut(database, update.shortcut);
  await files.recordQuickReplyMessageFiles(update.shortcut.first_message, 'live_update');
}
