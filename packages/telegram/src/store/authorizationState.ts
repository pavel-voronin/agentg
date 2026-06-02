import type { Database } from '../database/client.js';
import type { updateAuthorizationState as AuthorizationStateUpdate } from 'tdlib-types';
import { upsertTelegramKv } from './kv.js';

const AUTHORIZATION_STATE_KEY = 'authorization_state';

export async function storeAuthorizationState(
  database: Database,
  update: AuthorizationStateUpdate
): Promise<void> {
  await upsertTelegramKv(database, AUTHORIZATION_STATE_KEY, update.authorization_state);
}
