import { applyIngestionChanges } from '../../applyChanges.js';
import { managedBotChanges } from '../runtimeState.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ManagedBotUpdate = UpdateByType<'updateManagedBot'>;

export async function handleUpdateManagedBot(
  update: ManagedBotUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, managedBotChanges(update));
}
