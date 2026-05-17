import type { TelegramFileSubsystem } from '../telegram-file-subsystem.js';
import type { TelegramWireFileUpdate } from '../telegram-wire.js';

export function storeFileUpdate(
  files: TelegramFileSubsystem,
  update: TelegramWireFileUpdate
): Promise<void> {
  return files.handleUpdateFile(update);
}
