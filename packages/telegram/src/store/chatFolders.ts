import type { Database } from '../database/client.js';
import { telegramChatFolderInfos } from '../database/schema.js';
import { tdJsonObject } from '../tdlib/value.js';
import type { updateChatFolders as ChatFoldersUpdate } from 'tdlib-types';

export async function replaceChatFolders(
  database: Database,
  update: ChatFoldersUpdate
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
  folder: ChatFoldersUpdate['chat_folders'][number],
  position: number
): typeof telegramChatFolderInfos.$inferInsert {
  return {
    colorId: folder.color_id,
    hasMyInviteLinks: folder.has_my_invite_links,
    icon: tdJsonObject(folder.icon),
    id: folder.id,
    isShareable: folder.is_shareable,
    name: tdJsonObject(folder.name),
    position
  };
}
