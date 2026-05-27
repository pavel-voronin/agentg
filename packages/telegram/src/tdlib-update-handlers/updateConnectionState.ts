import { recordConnectionState } from '../telegram-store/connectionState.js';
import type { TelegramWireConnectionStateUpdate } from '../telegramWire.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';

export async function handleUpdateConnectionState(
  { events, liveCoverageObserver, tdlibStatus }: TelegramUpdateHandlerContext,
  update: TelegramWireConnectionStateUpdate
): Promise<void> {
  events.publishTelegramConnectionState(update);
  await recordConnectionState(update, { liveCoverageObserver, tdlibStatus });
}
