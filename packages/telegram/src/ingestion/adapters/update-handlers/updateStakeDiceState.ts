import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type StakeDiceStateUpdate = UpdateByType<'updateStakeDiceState'>;

export function handleUpdateStakeDiceState(
  update: StakeDiceStateUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
