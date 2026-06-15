import { applyIngestionChanges } from '../../applyChanges.js';
import { quickReplyMessageFileSlots } from '../fileSlot.js';
import { quickReplyShortcutMessagesChanges } from '../quickReply.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type QuickReplyShortcutMessagesUpdate = UpdateByType<'updateQuickReplyShortcutMessages'>;

export async function handleUpdateQuickReplyShortcutMessages(
  update: QuickReplyShortcutMessagesUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  await applyIngestionChanges(resources, quickReplyShortcutMessagesChanges(update));

  for (const message of update.messages) {
    await files.recordFileSlots(quickReplyMessageFileSlots(message), 'live_update');
  }
}
