import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireFreezeStateUpdate = TelegramWireUpdateByType<'updateFreezeState'>;

const FREEZE_STATE_KEY = 'freeze_state';

export async function handleUpdateFreezeState(
  update: TelegramWireFreezeStateUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const state = {
    appeal_link: update.appeal_link,
    deletion_date: update.deletion_date,
    freezing_date: update.freezing_date,
    is_frozen: update.is_frozen
  };

  await upsertTelegramKv(database, FREEZE_STATE_KEY, state);
  events.publishTelegramFreezeStateUpdated(state);
}
