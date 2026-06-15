import { deleteTelegramKv, upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type UnconfirmedSessionUpdate = UpdateByType<'updateUnconfirmedSession'>;

const UNCONFIRMED_SESSION_KEY = 'unconfirmed_session';

export async function handleUpdateUnconfirmedSession(
  update: UnconfirmedSessionUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const session = update.session ?? null;

  if (session === null) {
    await deleteTelegramKv(database, UNCONFIRMED_SESSION_KEY);
  } else {
    await upsertTelegramKv(database, UNCONFIRMED_SESSION_KEY, session);
  }
}
