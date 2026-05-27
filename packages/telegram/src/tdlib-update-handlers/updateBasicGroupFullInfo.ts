import { storeBasicGroupFullInfo } from '../telegram-store/basicGroupFullInfo.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

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
