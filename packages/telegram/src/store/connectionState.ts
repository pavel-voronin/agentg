import type { TelegramLiveCoverageObserver } from '../liveCoverage.js';
import type { TelegramWireConnectionStateUpdate } from '../tdlib/wire.js';

type TelegramConnectionStateTracker = {
  markConnectionState(connectionState: string): boolean;
};

export async function recordConnectionState(
  update: TelegramWireConnectionStateUpdate,
  runtime: {
    liveCoverageObserver: TelegramLiveCoverageObserver;
    tdlibStatus: TelegramConnectionStateTracker;
  }
): Promise<void> {
  const connectedForLiveCoverage = runtime.tdlibStatus.markConnectionState(update.state._);
  if (connectedForLiveCoverage) {
    await runtime.liveCoverageObserver.markConnected();
    return;
  }

  await runtime.liveCoverageObserver.markDisconnected();
}
