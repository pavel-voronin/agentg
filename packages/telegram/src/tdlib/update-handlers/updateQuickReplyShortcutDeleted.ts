import { deleteQuickReplyShortcut } from '../../store/quickReply.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireQuickReplyShortcutDeletedUpdate =
  TelegramWireUpdateByType<'updateQuickReplyShortcutDeleted'>;

export async function handleUpdateQuickReplyShortcutDeleted(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireQuickReplyShortcutDeletedUpdate
): Promise<void> {
  await deleteQuickReplyShortcut(database, update.shortcut_id);
  events.publishTelegramQuickReplyShortcutDeleted(update);
}
