import { storeAuthorizationState } from '../../store/authorizationState.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireAuthorizationStateUpdate } from '../wire.js';

export async function handleUpdateAuthorizationState(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireAuthorizationStateUpdate
): Promise<void> {
  await storeAuthorizationState(database, update);
}
