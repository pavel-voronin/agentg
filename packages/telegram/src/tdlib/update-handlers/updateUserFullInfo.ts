import { storeUserFullInfo } from '../../store/userFullInfo.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireUserFullInfoUpdate = TelegramWireUpdateByType<'updateUserFullInfo'>;

export async function handleUpdateUserFullInfo(
  update: TelegramWireUserFullInfoUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
  const userId = String(update.user_id);

  await storeUserFullInfo(database, userId, update.user_full_info);
  await files.recordUserFullInfoFiles(userId, update.user_full_info, 'live_update');
  events.publishTelegramUserFullInfoUpdated({ userId });
}
