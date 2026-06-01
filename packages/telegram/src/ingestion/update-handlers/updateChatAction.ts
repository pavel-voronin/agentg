import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatActionUpdate = UpdateByType<'updateChatAction'>;

export async function handleUpdateChatAction(
  update: ChatActionUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramChatAction(update);
}
