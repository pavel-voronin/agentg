import { upsertQuickReplyShortcut } from '../../store/quickReply.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireQuickReplyShortcutUpdate = TelegramWireUpdateByType<'updateQuickReplyShortcut'>;

export async function handleUpdateQuickReplyShortcut(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireQuickReplyShortcutUpdate
): Promise<void> {
  await upsertQuickReplyShortcut(database, update.shortcut);
  await files.recordQuickReplyMessageFiles(update.shortcut.first_message, 'live_update');
  events.publishTelegramQuickReplyShortcutUpdated(update);
}
