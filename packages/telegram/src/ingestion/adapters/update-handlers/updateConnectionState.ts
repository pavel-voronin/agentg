import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ConnectionStateUpdate = UpdateByType<'updateConnectionState'>;

export async function handleUpdateConnectionState(
  update: ConnectionStateUpdate,
  resources: IngestionResources
): Promise<void> {
  const connectedForLiveCoverage = resources.status.markConnectionState(update.state._);
  if (connectedForLiveCoverage) {
    await resources.liveCoverage.markConnected();
    return;
  }

  await resources.liveCoverage.markDisconnected();
}
