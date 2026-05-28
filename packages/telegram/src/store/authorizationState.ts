import type { TelegramDatabase } from '../database/client.js';
import type { TelegramWireAuthorizationStateUpdate } from '../tdlib/wire.js';
import { upsertTelegramKv } from './kv.js';

const AUTHORIZATION_STATE_KEY = 'authorization_state';

export async function storeAuthorizationState(
  database: TelegramDatabase,
  update: TelegramWireAuthorizationStateUpdate
): Promise<void> {
  await upsertTelegramKv(database, AUTHORIZATION_STATE_KEY, update.authorization_state);
}
