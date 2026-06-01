import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type NewGroupCallPaidReactionUpdate = UpdateByType<'updateNewGroupCallPaidReaction'>;

export async function handleUpdateNewGroupCallPaidReaction(
  update: NewGroupCallPaidReactionUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramGroupCallPaidReactionReceived(update);
}
