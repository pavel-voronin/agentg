import { storeChatBoost } from '../../store/chatBoost.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatBoostUpdate = UpdateByType<'updateChatBoost'>;

export async function handleUpdateChatBoost(
  update: ChatBoostUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await storeChatBoost(database, update);
}
