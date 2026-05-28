import { recordConnectionState } from '../../store/connectionState.js';
import type { TelegramWireConnectionStateUpdate } from '../wire.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';

export async function handleUpdateConnectionState(
  { events, liveCoverageObserver, tdlibStatus }: TelegramUpdateHandlerContext,
  update: TelegramWireConnectionStateUpdate
): Promise<void> {
  events.publishTelegramConnectionState(update);
  await recordConnectionState(update, { liveCoverageObserver, tdlibStatus });
}
