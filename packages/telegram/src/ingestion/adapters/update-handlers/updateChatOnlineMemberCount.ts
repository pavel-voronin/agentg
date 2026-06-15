import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ChatOnlineMemberCountUpdate = UpdateByType<'updateChatOnlineMemberCount'>;

export function handleUpdateChatOnlineMemberCount(
  update: ChatOnlineMemberCountUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
