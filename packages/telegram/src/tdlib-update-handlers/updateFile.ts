import type { TdlibUpdateFile } from '../tdlib-schema/UpdateFile.js';
import type { TelegramUpdateHandlerContext } from './context.js';

export async function handleUpdateFile(
  { files }: TelegramUpdateHandlerContext,
  update: TdlibUpdateFile
): Promise<void> {
  await files.handleUpdateFile(update);
}
