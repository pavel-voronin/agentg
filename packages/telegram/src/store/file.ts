import type { TelegramFileSubsystem } from '../fileSubsystem.js';
import type { TelegramWireFileUpdate } from '../tdlib/wire.js';

export function storeFileUpdate(
  files: TelegramFileSubsystem,
  update: TelegramWireFileUpdate
): Promise<void> {
  return files.handleUpdateFile(update);
}
