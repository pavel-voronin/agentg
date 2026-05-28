import { storeBusinessConnection } from '../../store/businessConnection.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireBusinessConnectionUpdate = TelegramWireUpdateByType<'updateBusinessConnection'>;

export async function handleUpdateBusinessConnection(
  { database, events }: TelegramUpdateHandlerContext,
  { connection }: TelegramWireBusinessConnectionUpdate
): Promise<void> {
  await storeBusinessConnection(database, connection);
  events.publishTelegramBusinessConnectionUpdated(connection.id);
}
