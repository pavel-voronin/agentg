import { storeCall } from '../../store/call.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireCallUpdate = TelegramWireUpdateByType<'updateCall'>;

export async function handleUpdateCall({ call }: TelegramWireCallUpdate): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await storeCall(database, call);
  events.publishTelegramCallUpdated(call);
}
