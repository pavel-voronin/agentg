import { storeSupergroupFullInfo } from '../../store/supergroupFullInfo.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireSupergroupFullInfoUpdate } from '../wire.js';

export async function handleUpdateSupergroupFullInfo(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireSupergroupFullInfoUpdate
): Promise<void> {
  const supergroupId = String(update.supergroup_id);

  await database.transaction(async (transaction) => {
    await storeSupergroupFullInfo(transaction, supergroupId, update.supergroup_full_info);
  });

  events.publishTelegramSupergroupUpdated(supergroupId);
}
