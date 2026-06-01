import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type StakeDiceStateUpdate = UpdateByType<'updateStakeDiceState'>;

export async function handleUpdateStakeDiceState(
  update: StakeDiceStateUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramStakeDiceStateUpdated(update);
  return Promise.resolve();
}
