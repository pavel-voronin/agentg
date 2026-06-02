import type { FileSubsystem } from '../files/index.js';
import type { updateFile as FileUpdate } from 'tdlib-types';

export function storeFileUpdate(files: FileSubsystem, update: FileUpdate): Promise<void> {
  return files.handleUpdateFile(update);
}
