import { storeBusinessConnection } from '../telegram-store/businessConnection.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireBusinessConnectionUpdate = TelegramWireUpdateByType<'updateBusinessConnection'>;

export async function handleUpdateBusinessConnection(
  { database, events }: TelegramUpdateHandlerContext,
  { connection }: TelegramWireBusinessConnectionUpdate
): Promise<void> {
  await storeBusinessConnection(database, connection);
  events.publishTelegramBusinessConnectionUpdated(connection.id);
}
