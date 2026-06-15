import { recordConnectionState } from '../../store/connectionState.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ConnectionStateUpdate = UpdateByType<'updateConnectionState'>;

export async function handleUpdateConnectionState(
  update: ConnectionStateUpdate,
  resources: IngestionResources
): Promise<void> {
  const { liveCoverage: liveCoverageObserver } = resources;
  const { status: tdlibStatus } = resources;
  await recordConnectionState(update, { liveCoverageObserver, tdlibStatus });
}
