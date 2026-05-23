import { recordConnectionState } from '../telegram-store/connectionState.js';
import type { TelegramWireConnectionStateUpdate } from '../telegramWire.js';
import type { TelegramUpdateHandlerContext } from './context.js';

export async function handleUpdateConnectionState(
  { liveCoverageObserver, tdlibStatus }: TelegramUpdateHandlerContext,
  update: TelegramWireConnectionStateUpdate
): Promise<void> {
  await recordConnectionState(update, { liveCoverageObserver, tdlibStatus });
}
