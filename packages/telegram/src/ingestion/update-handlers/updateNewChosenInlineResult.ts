import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type NewChosenInlineResultUpdate = UpdateByType<'updateNewChosenInlineResult'>;

export async function handleUpdateNewChosenInlineResult(
  update: NewChosenInlineResultUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramChosenInlineResultReceived(update);
}
