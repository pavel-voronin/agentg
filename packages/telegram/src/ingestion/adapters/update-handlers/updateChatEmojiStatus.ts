import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatEmojiStatusChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatEmojiStatusUpdate = UpdateByType<'updateChatEmojiStatus'>;

export async function handleUpdateChatEmojiStatus(
  update: ChatEmojiStatusUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatEmojiStatusChanges(update));
}
