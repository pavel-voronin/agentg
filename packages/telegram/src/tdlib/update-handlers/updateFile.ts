import { storeFileUpdate } from '../../store/file.js';
import type { TelegramWireFileUpdate } from '../wire.js';
import { useFiles } from '../../files/subsystem.js';

export async function handleUpdateFile(update: TelegramWireFileUpdate): Promise<void> {
  const files = useFiles();
  await storeFileUpdate(files, update);
}
