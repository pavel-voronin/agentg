import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type NewGroupCallPaidReactionUpdate = UpdateByType<'updateNewGroupCallPaidReaction'>;

export function handleUpdateNewGroupCallPaidReaction(
  update: NewGroupCallPaidReactionUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
