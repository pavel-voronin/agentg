import { applyIngestionChanges } from '../../applyChanges.js';
import { quickReplyShortcutDeletedChanges } from '../quickReply.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type QuickReplyShortcutDeletedUpdate = UpdateByType<'updateQuickReplyShortcutDeleted'>;

export async function handleUpdateQuickReplyShortcutDeleted(
  update: QuickReplyShortcutDeletedUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, quickReplyShortcutDeletedChanges(update));
}
