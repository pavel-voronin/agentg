import { storeBasicGroupFullInfo } from '../../store/basicGroupFullInfo.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireBasicGroupFullInfoUpdate = TelegramWireUpdateByType<'updateBasicGroupFullInfo'>;

export async function handleUpdateBasicGroupFullInfo(
  update: TelegramWireBasicGroupFullInfoUpdate
): Promise<void> {
  const database = useDatabase();
  const basicGroupId = String(update.basic_group_id);

  await database.transaction(async (transaction) => {
    await storeBasicGroupFullInfo(transaction, basicGroupId, update.basic_group_full_info);
  });
}
