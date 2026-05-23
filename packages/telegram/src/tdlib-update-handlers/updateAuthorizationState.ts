import { recordAuthorizationState } from '../telegram-store/authorizationState.js';
import type { TelegramWireAuthorizationStateUpdate } from '../telegramWire.js';

export function handleUpdateAuthorizationState(update: TelegramWireAuthorizationStateUpdate): void {
  recordAuthorizationState(update);
}
