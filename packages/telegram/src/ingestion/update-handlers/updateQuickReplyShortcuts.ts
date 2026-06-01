import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type QuickReplyShortcutsUpdate = UpdateByType<'updateQuickReplyShortcuts'>;

export function handleUpdateQuickReplyShortcuts(
  update: QuickReplyShortcutsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, 'quick_reply_shortcut_ids', update.shortcut_ids);
}
