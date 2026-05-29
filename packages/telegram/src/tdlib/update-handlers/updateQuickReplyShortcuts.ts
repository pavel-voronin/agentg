import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireQuickReplyShortcutsUpdate = TelegramWireUpdateByType<'updateQuickReplyShortcuts'>;

export function handleUpdateQuickReplyShortcuts(
  update: TelegramWireQuickReplyShortcutsUpdate
): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, 'quick_reply_shortcut_ids', update.shortcut_ids);
}
