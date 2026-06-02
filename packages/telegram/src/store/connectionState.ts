import type { LiveCoverageObserver } from '../history/liveCoverage.js';
import type { updateConnectionState as ConnectionStateUpdate } from 'tdlib-types';

type ConnectionStateTracker = {
  markConnectionState(connectionState: string): boolean;
};

export async function recordConnectionState(
  update: ConnectionStateUpdate,
  runtime: {
    liveCoverageObserver: LiveCoverageObserver;
    tdlibStatus: ConnectionStateTracker;
  }
): Promise<void> {
  const connectedForLiveCoverage = runtime.tdlibStatus.markConnectionState(update.state._);
  if (connectedForLiveCoverage) {
    await runtime.liveCoverageObserver.markConnected();
    return;
  }

  await runtime.liveCoverageObserver.markDisconnected();
}
