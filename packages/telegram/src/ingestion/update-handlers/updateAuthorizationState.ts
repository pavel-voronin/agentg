import { storeAuthorizationState } from '../../store/authorizationState.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type AuthorizationStateUpdate = UpdateByType<'updateAuthorizationState'>;

export async function handleUpdateAuthorizationState(
  update: AuthorizationStateUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await storeAuthorizationState(database, update);
}
