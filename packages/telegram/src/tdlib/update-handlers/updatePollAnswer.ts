import { replaceTelegramPollAnswerOptions } from '../../store/poll.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWirePollAnswerUpdate = TelegramWireUpdateByType<'updatePollAnswer'>;

export async function handleUpdatePollAnswer(update: TelegramWirePollAnswerUpdate): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await replaceTelegramPollAnswerOptions(database, update);
  events.publishTelegramPollAnswerUpdated(update);
}
