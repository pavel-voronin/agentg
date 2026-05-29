import { storeSupergroupFullInfo } from '../../store/supergroupFullInfo.js';
import type { TelegramWireSupergroupFullInfoUpdate } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

export async function handleUpdateSupergroupFullInfo(
  update: TelegramWireSupergroupFullInfoUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const supergroupId = String(update.supergroup_id);

  await database.transaction(async (transaction) => {
    await storeSupergroupFullInfo(transaction, supergroupId, update.supergroup_full_info);
  });

  events.publishTelegramSupergroupUpdated(supergroupId);
}
