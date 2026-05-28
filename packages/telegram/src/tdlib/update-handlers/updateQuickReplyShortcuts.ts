import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireQuickReplyShortcutsUpdate = TelegramWireUpdateByType<'updateQuickReplyShortcuts'>;

export function handleUpdateQuickReplyShortcuts(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireQuickReplyShortcutsUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'quick_reply_shortcut_ids', update.shortcut_ids);
}
