import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type WebAppMessageSentUpdate = UpdateByType<'updateWebAppMessageSent'>;

export async function handleUpdateWebAppMessageSent(
  update: WebAppMessageSentUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramWebAppCloseRequested(update);
  return Promise.resolve();
}
