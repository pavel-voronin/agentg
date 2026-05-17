import { storeFileUpdate } from '../telegram-store/File.js';
import type { TelegramWireFileUpdate } from '../telegram-wire.js';
import type { TelegramUpdateHandlerContext } from './context.js';

export async function handleUpdateFile(
  { files }: TelegramUpdateHandlerContext,
  update: TelegramWireFileUpdate
): Promise<void> {
  await storeFileUpdate(files, update);
}
