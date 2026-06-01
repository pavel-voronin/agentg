import { storeChatRevenueAmount } from '../../store/chatRevenueAmount.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatRevenueAmountUpdate = UpdateByType<'updateChatRevenueAmount'>;

export async function handleUpdateChatRevenueAmount(
  update: ChatRevenueAmountUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await storeChatRevenueAmount(database, update);
}
