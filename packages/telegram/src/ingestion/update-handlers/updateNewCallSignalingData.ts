import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type NewCallSignalingDataUpdate = UpdateByType<'updateNewCallSignalingData'>;

export async function handleUpdateNewCallSignalingData(
  update: NewCallSignalingDataUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramCallSignalingDataReceived(update);
}
