import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatBusinessBotManageBarChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatBusinessBotManageBarUpdate = UpdateByType<'updateChatBusinessBotManageBar'>;

export async function handleUpdateChatBusinessBotManageBar(
  update: ChatBusinessBotManageBarUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatBusinessBotManageBarChanges(update));
}
