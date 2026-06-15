import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type FreezeStateUpdate = UpdateByType<'updateFreezeState'>;

const FREEZE_STATE_KEY = 'freeze_state';

export async function handleUpdateFreezeState(
  update: FreezeStateUpdate,
  resources: IngestionResources
): Promise<void> {
  const state = {
    appeal_link: update.appeal_link,
    deletion_date: update.deletion_date,
    freezing_date: update.freezing_date,
    is_frozen: update.is_frozen
  };

  await saveKvEntry(resources, FREEZE_STATE_KEY, state);
}
