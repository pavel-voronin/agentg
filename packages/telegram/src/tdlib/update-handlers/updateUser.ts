import { storeUser } from '../../store/user.js';
import type { TelegramWireUserUpdate } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

export async function handleUpdateUser({ user }: TelegramWireUserUpdate): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await storeUser(database, user);
  events.publishTelegramUserUpdated(user);
}
