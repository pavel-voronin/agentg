import type { TelegramFileSubsystem } from '../telegramFileSubsystem.js';
import type { TelegramWireFileUpdate } from '../telegramWire.js';

export function storeFileUpdate(
  files: TelegramFileSubsystem,
  update: TelegramWireFileUpdate
): Promise<void> {
  return files.handleUpdateFile(update);
}
