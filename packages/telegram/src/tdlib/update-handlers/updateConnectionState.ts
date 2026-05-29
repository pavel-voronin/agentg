import { recordConnectionState } from '../../store/connectionState.js';
import type { TelegramWireConnectionStateUpdate } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useLiveCoverage } from '../../history/subsystem.js';
import { useTelegramStatus } from '../../status/subsystem.js';

export async function handleUpdateConnectionState(
  update: TelegramWireConnectionStateUpdate
): Promise<void> {
  const events = useUpdateEvents();
  const liveCoverageObserver = useLiveCoverage();
  const tdlibStatus = useTelegramStatus();
  events.publishTelegramConnectionState(update);
  await recordConnectionState(update, { liveCoverageObserver, tdlibStatus });
}
