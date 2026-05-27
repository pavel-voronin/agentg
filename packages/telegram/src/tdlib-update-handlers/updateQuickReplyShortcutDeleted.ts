import { deleteQuickReplyShortcut } from '../telegram-store/quickReply.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireQuickReplyShortcutDeletedUpdate =
  TelegramWireUpdateByType<'updateQuickReplyShortcutDeleted'>;

export async function handleUpdateQuickReplyShortcutDeleted(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireQuickReplyShortcutDeletedUpdate
): Promise<void> {
  await deleteQuickReplyShortcut(database, update.shortcut_id);
  events.publishTelegramQuickReplyShortcutDeleted(update);
}
