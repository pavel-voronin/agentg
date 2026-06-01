import { storeAuthorizationState } from '../../store/authorizationState.js';
import type { AuthorizationStateUpdate } from '../types.js';
import type { IngestionResources } from '../resources.js';

export async function handleUpdateAuthorizationState(
  update: AuthorizationStateUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await storeAuthorizationState(database, update);
}
