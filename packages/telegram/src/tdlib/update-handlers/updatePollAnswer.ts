import { replaceTelegramPollAnswerOptions } from '../../store/poll.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWirePollAnswerUpdate = TelegramWireUpdateByType<'updatePollAnswer'>;

export async function handleUpdatePollAnswer(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWirePollAnswerUpdate
): Promise<void> {
  await replaceTelegramPollAnswerOptions(database, update);
  events.publishTelegramPollAnswerUpdated(update);
}
