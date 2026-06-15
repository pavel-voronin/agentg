import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type QuickReplyShortcutsUpdate = UpdateByType<'updateQuickReplyShortcuts'>;

export function handleUpdateQuickReplyShortcuts(
  update: QuickReplyShortcutsUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(resources, 'quick_reply_shortcut_ids', update.shortcut_ids);
}
