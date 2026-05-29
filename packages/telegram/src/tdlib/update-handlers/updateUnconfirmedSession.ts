import { deleteTelegramKv, upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireUnconfirmedSessionUpdate = TelegramWireUpdateByType<'updateUnconfirmedSession'>;

const UNCONFIRMED_SESSION_KEY = 'unconfirmed_session';

export async function handleUpdateUnconfirmedSession(
  update: TelegramWireUnconfirmedSessionUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const session = update.session ?? null;

  if (session === null) {
    await deleteTelegramKv(database, UNCONFIRMED_SESSION_KEY);
  } else {
    await upsertTelegramKv(database, UNCONFIRMED_SESSION_KEY, session);
  }

  events.publishTelegramUnconfirmedSessionUpdated(update);
}
