import { recordConnectionState } from '../../store/connectionState.js';
import type { ConnectionStateUpdate } from '../types.js';
import type { IngestionResources } from '../resources.js';

export async function handleUpdateConnectionState(
  update: ConnectionStateUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  const { liveCoverage: liveCoverageObserver } = resources;
  const { status: tdlibStatus } = resources;
  await events.publishTelegramConnectionState(update);
  await recordConnectionState(update, { liveCoverageObserver, tdlibStatus });
}
