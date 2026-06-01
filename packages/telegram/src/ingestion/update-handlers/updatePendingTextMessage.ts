import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type PendingTextMessageUpdate = UpdateByType<'updatePendingTextMessage'>;

export async function handleUpdatePendingTextMessage(
  update: PendingTextMessageUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramPendingTextMessageUpdated(update);
}
