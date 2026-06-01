import { deleteQuickReplyShortcut } from '../../store/quickReply.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type QuickReplyShortcutDeletedUpdate = UpdateByType<'updateQuickReplyShortcutDeleted'>;

export async function handleUpdateQuickReplyShortcutDeleted(
  update: QuickReplyShortcutDeletedUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  await deleteQuickReplyShortcut(database, update.shortcut_id);
  await events.publishTelegramQuickReplyShortcutDeleted(update);
}
