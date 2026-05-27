import { storeBasicGroup } from '../telegram-store/basicGroup.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireBasicGroupUpdate = TelegramWireUpdateByType<'updateBasicGroup'>;

export async function handleUpdateBasicGroup(
  { database }: TelegramUpdateHandlerContext,
  { basic_group: basicGroup }: TelegramWireBasicGroupUpdate
): Promise<void> {
  await storeBasicGroup(database, basicGroup);
}
