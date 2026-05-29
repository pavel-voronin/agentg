import { storeAuthorizationState } from '../../store/authorizationState.js';
import type { TelegramWireAuthorizationStateUpdate } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

export async function handleUpdateAuthorizationState(
  update: TelegramWireAuthorizationStateUpdate
): Promise<void> {
  const database = useDatabase();
  await storeAuthorizationState(database, update);
}
