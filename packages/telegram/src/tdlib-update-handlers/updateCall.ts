import { storeCall } from '../telegram-store/call.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireCallUpdate = TelegramWireUpdateByType<'updateCall'>;

export async function handleUpdateCall(
  { database, events }: TelegramUpdateHandlerContext,
  { call }: TelegramWireCallUpdate
): Promise<void> {
  await storeCall(database, call);
  events.publishTelegramCallUpdated(call);
}
