import type { UpdateByType } from '../updateTypes.js';
import { saveKvEntry } from '../../kv.js';
import type { IngestionResources } from '../../resources.js';

type AuthorizationStateUpdate = UpdateByType<'updateAuthorizationState'>;

const AUTHORIZATION_STATE_KEY = 'authorization_state';

export async function handleUpdateAuthorizationState(
  update: AuthorizationStateUpdate,
  resources: IngestionResources
): Promise<void> {
  await saveKvEntry(resources, AUTHORIZATION_STATE_KEY, update.authorization_state);
}
