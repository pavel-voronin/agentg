import { storeAuthorizationState } from '../telegram-store/authorizationState.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireAuthorizationStateUpdate } from '../telegramWire.js';

export async function handleUpdateAuthorizationState(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireAuthorizationStateUpdate
): Promise<void> {
  await storeAuthorizationState(database, update);
}
