import type { Database } from '../database/client.js';
import { asc } from 'drizzle-orm';
import { telegramChatFolderInfos } from '../database/schema.js';
import type { ChatFolderInfo } from '../domain/models/chatFolder.js';

export async function replaceChatFolderInfos(
  database: Database,
  folders: readonly ChatFolderInfo[]
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.delete(telegramChatFolderInfos);
    if (folders.length > 0) {
      await transaction.insert(telegramChatFolderInfos).values([...folders]);
    }
  });
}

export async function readKnownChatFolderIds(database: Database): Promise<number[]> {
  const rows = await database
    .select({
      folderId: telegramChatFolderInfos.id
    })
    .from(telegramChatFolderInfos)
    .orderBy(asc(telegramChatFolderInfos.position), asc(telegramChatFolderInfos.id));

  return rows.map((row) => row.folderId);
}
