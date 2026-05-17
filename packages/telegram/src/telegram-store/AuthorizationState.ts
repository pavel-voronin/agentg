import type { TelegramWireAuthorizationStateUpdate } from '../telegram-wire.js';

export function recordAuthorizationState(update: TelegramWireAuthorizationStateUpdate): void {
  console.log(
    JSON.stringify({
      event: 'telegram.authorization_state',
      state: update.authorization_state._
    })
  );
}
