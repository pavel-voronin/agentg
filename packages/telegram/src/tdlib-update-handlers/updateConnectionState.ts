import { recordConnectionState } from '../telegram-store/ConnectionState.js';
import type { TelegramWireConnectionStateUpdate } from '../telegram-wire.js';
import type { TelegramUpdateHandlerContext } from './context.js';

export async function handleUpdateConnectionState(
  { liveCoverageObserver, tdlibStatus }: TelegramUpdateHandlerContext,
  update: TelegramWireConnectionStateUpdate
): Promise<void> {
  await recordConnectionState(update, { liveCoverageObserver, tdlibStatus });
}
