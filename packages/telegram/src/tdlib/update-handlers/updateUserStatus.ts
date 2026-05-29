import { storeUserStatus } from '../../store/userStatus.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireUserStatusUpdate = TelegramWireUpdateByType<'updateUserStatus'>;

export async function handleUpdateUserStatus(update: TelegramWireUserStatusUpdate): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await storeUserStatus(database, update.user_id, update.status);
  events.publishTelegramUserStatusUpdated(update);
}
