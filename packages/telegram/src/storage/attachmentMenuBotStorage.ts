import type { Database } from '../database/client.js';
import { telegramAttachmentMenuBots } from '../database/schema.js';
import type { AttachmentMenuBot } from '../domain/models/attachmentMenuBot.js';

export async function replaceAttachmentMenuBots(
  database: Database,
  bots: readonly AttachmentMenuBot[]
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.delete(telegramAttachmentMenuBots);
    if (bots.length > 0) {
      await transaction.insert(telegramAttachmentMenuBots).values([...bots]);
    }
  });
}
