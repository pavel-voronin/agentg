import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ChatActionUpdate = UpdateByType<'updateChatAction'>;

export function handleUpdateChatAction(
  update: ChatActionUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
