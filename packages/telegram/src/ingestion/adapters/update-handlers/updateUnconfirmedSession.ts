import { deleteKvEntry, saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type UnconfirmedSessionUpdate = UpdateByType<'updateUnconfirmedSession'>;

const UNCONFIRMED_SESSION_KEY = 'unconfirmed_session';

export async function handleUpdateUnconfirmedSession(
  update: UnconfirmedSessionUpdate,
  resources: IngestionResources
): Promise<void> {
  const session = update.session ?? null;

  if (session === null) {
    await deleteKvEntry(resources, UNCONFIRMED_SESSION_KEY);
  } else {
    await saveKvEntry(resources, UNCONFIRMED_SESSION_KEY, session);
  }
}
