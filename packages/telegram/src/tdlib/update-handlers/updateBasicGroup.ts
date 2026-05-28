import { storeBasicGroup } from '../../store/basicGroup.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireBasicGroupUpdate = TelegramWireUpdateByType<'updateBasicGroup'>;

export async function handleUpdateBasicGroup(
  { database }: TelegramUpdateHandlerContext,
  { basic_group: basicGroup }: TelegramWireBasicGroupUpdate
): Promise<void> {
  await storeBasicGroup(database, basicGroup);
}
