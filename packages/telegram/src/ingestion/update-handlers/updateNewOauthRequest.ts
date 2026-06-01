import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type NewOauthRequestUpdate = UpdateByType<'updateNewOauthRequest'>;

export async function handleUpdateNewOauthRequest(
  update: NewOauthRequestUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramOauthRequestReceived(update);
}
