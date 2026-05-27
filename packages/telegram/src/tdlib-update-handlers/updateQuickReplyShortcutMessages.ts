import { replaceQuickReplyShortcutMessages } from '../telegram-store/quickReply.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireQuickReplyShortcutMessagesUpdate =
  TelegramWireUpdateByType<'updateQuickReplyShortcutMessages'>;

export async function handleUpdateQuickReplyShortcutMessages(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireQuickReplyShortcutMessagesUpdate
): Promise<void> {
  await replaceQuickReplyShortcutMessages(database, {
    messages: update.messages,
    shortcutId: update.shortcut_id
  });

  for (const message of update.messages) {
    await files.recordQuickReplyMessageFiles(message, 'live_update');
  }

  events.publishTelegramQuickReplyShortcutMessagesUpdated(update);
}
