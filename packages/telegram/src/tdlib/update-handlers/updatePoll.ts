import { replaceTelegramPoll } from '../../store/poll.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWirePollUpdate = TelegramWireUpdateByType<'updatePoll'>;

export async function handleUpdatePoll(update: TelegramWirePollUpdate): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await replaceTelegramPoll(database, update.poll);
  events.publishTelegramPollUpdated(update);
}
