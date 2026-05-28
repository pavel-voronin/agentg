import { storeFileUpdate } from '../../store/file.js';
import type { TelegramWireFileUpdate } from '../wire.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';

export async function handleUpdateFile(
  { files }: TelegramUpdateHandlerContext,
  update: TelegramWireFileUpdate
): Promise<void> {
  await storeFileUpdate(files, update);
}
