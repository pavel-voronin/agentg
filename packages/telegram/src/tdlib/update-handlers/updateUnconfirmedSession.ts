import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { deleteTelegramKv, upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireUnconfirmedSessionUpdate = TelegramWireUpdateByType<'updateUnconfirmedSession'>;

const UNCONFIRMED_SESSION_KEY = 'unconfirmed_session';

export async function handleUpdateUnconfirmedSession(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireUnconfirmedSessionUpdate
): Promise<void> {
  const session = update.session ?? null;

  if (session === null) {
    await deleteTelegramKv(database, UNCONFIRMED_SESSION_KEY);
  } else {
    await upsertTelegramKv(database, UNCONFIRMED_SESSION_KEY, session);
  }

  events.publishTelegramUnconfirmedSessionUpdated(update);
}
