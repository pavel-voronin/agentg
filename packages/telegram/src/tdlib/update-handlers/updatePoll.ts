import { replaceTelegramPoll } from '../../store/poll.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWirePollUpdate = TelegramWireUpdateByType<'updatePoll'>;

export async function handleUpdatePoll(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWirePollUpdate
): Promise<void> {
  await replaceTelegramPoll(database, update.poll);
  events.publishTelegramPollUpdated(update);
}
