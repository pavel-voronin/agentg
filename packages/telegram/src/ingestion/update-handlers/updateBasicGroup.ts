import { storeBasicGroup } from '../../store/basicGroup.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type BasicGroupUpdate = UpdateByType<'updateBasicGroup'>;

export async function handleUpdateBasicGroup(
  { basic_group: basicGroup }: BasicGroupUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await storeBasicGroup(database, basicGroup);
}
