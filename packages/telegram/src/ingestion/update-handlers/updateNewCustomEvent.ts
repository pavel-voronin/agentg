import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type NewCustomEventUpdate = UpdateByType<'updateNewCustomEvent'>;

export async function handleUpdateNewCustomEvent(
  update: NewCustomEventUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramCustomEventReceived(update);
}
