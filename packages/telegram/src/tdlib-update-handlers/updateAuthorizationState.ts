import { recordAuthorizationState } from '../telegram-store/AuthorizationState.js';
import type { TelegramWireAuthorizationStateUpdate } from '../telegram-wire.js';

export function handleUpdateAuthorizationState(update: TelegramWireAuthorizationStateUpdate): void {
  recordAuthorizationState(update);
}
