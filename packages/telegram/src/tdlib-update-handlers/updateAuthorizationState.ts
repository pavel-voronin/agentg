import type { TdlibUpdateAuthorizationState } from '../tdlib-schema/UpdateAuthorizationState.js';

export function handleUpdateAuthorizationState(update: TdlibUpdateAuthorizationState): void {
  console.log(
    JSON.stringify({
      event: 'telegram.authorization_state',
      state: update.authorization_state._
    })
  );
}
