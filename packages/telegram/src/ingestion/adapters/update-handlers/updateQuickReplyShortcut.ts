import { applyIngestionChanges } from '../../applyChanges.js';
import { quickReplyMessageFileSlots } from '../fileSlot.js';
import { quickReplyShortcutChanges } from '../quickReply.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type QuickReplyShortcutUpdate = UpdateByType<'updateQuickReplyShortcut'>;

export async function handleUpdateQuickReplyShortcut(
  update: QuickReplyShortcutUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  await applyIngestionChanges(resources, quickReplyShortcutChanges(update));
  await files.recordFileSlots(
    quickReplyMessageFileSlots(update.shortcut.first_message),
    'live_update'
  );
}
