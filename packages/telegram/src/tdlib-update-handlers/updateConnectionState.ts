import type { TdlibUpdateConnectionState } from '../tdlib-schema/UpdateConnectionState.js';
import type { TelegramUpdateHandlerContext } from './context.js';

export async function handleUpdateConnectionState(
  { liveCoverageObserver, tdlibStatus }: TelegramUpdateHandlerContext,
  update: TdlibUpdateConnectionState
): Promise<void> {
  console.log(
    JSON.stringify({
      event: 'telegram.connection_state',
      state: update.state._
    })
  );

  const connectedForLiveCoverage = tdlibStatus.markConnectionState(update.state._);
  if (connectedForLiveCoverage) {
    await liveCoverageObserver.markConnected();
    return;
  }

  await liveCoverageObserver.markDisconnected();
}
