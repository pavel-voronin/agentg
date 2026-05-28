import { storeCall } from '../../store/call.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireCallUpdate = TelegramWireUpdateByType<'updateCall'>;

export async function handleUpdateCall(
  { database, events }: TelegramUpdateHandlerContext,
  { call }: TelegramWireCallUpdate
): Promise<void> {
  await storeCall(database, call);
  events.publishTelegramCallUpdated(call);
}
