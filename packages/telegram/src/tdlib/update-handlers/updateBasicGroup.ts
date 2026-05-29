import { storeBasicGroup } from '../../store/basicGroup.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireBasicGroupUpdate = TelegramWireUpdateByType<'updateBasicGroup'>;

export async function handleUpdateBasicGroup({
  basic_group: basicGroup
}: TelegramWireBasicGroupUpdate): Promise<void> {
  const database = useDatabase();
  await storeBasicGroup(database, basicGroup);
}
