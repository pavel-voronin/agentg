import { storeBusinessConnection } from '../../store/businessConnection.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireBusinessConnectionUpdate = TelegramWireUpdateByType<'updateBusinessConnection'>;

export async function handleUpdateBusinessConnection({
  connection
}: TelegramWireBusinessConnectionUpdate): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await storeBusinessConnection(database, connection);
  events.publishTelegramBusinessConnectionUpdated(connection.id);
}
