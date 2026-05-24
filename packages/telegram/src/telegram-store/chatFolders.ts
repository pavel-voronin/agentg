import type { TelegramDatabase } from '../database.js';
import { telegramChatFolderInfos } from '../schema.js';
import { telegramWireJsonObject, type TelegramWireChatFoldersUpdate } from '../telegramWire.js';

export async function replaceChatFolders(
  database: TelegramDatabase,
  update: TelegramWireChatFoldersUpdate
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.delete(telegramChatFolderInfos);
    if (update.chat_folders.length > 0) {
      await transaction
        .insert(telegramChatFolderInfos)
        .values(update.chat_folders.map((folder, position) => chatFolderInfoRow(folder, position)));
    }
  });
}

function chatFolderInfoRow(
  folder: TelegramWireChatFoldersUpdate['chat_folders'][number],
  position: number
): typeof telegramChatFolderInfos.$inferInsert {
  return {
    colorId: folder.color_id,
    hasMyInviteLinks: folder.has_my_invite_links,
    icon: telegramWireJsonObject(folder.icon),
    id: folder.id,
    isShareable: folder.is_shareable,
    name: telegramWireJsonObject(folder.name),
    position
  };
}
