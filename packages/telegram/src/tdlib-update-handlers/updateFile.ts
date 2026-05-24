import { storeFileUpdate } from '../telegram-store/file.js';
import type { TelegramWireFileUpdate } from '../telegramWire.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';

export async function handleUpdateFile(
  { files }: TelegramUpdateHandlerContext,
  update: TelegramWireFileUpdate
): Promise<void> {
  await storeFileUpdate(files, update);
}
