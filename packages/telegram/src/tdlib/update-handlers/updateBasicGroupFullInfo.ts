import { storeBasicGroupFullInfo } from '../../store/basicGroupFullInfo.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireBasicGroupFullInfoUpdate = TelegramWireUpdateByType<'updateBasicGroupFullInfo'>;

export async function handleUpdateBasicGroupFullInfo(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireBasicGroupFullInfoUpdate
): Promise<void> {
  const basicGroupId = String(update.basic_group_id);

  await database.transaction(async (transaction) => {
    await storeBasicGroupFullInfo(transaction, basicGroupId, update.basic_group_full_info);
  });
}
