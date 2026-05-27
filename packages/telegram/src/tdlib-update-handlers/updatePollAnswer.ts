import { replaceTelegramPollAnswerOptions } from '../telegram-store/poll.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWirePollAnswerUpdate = TelegramWireUpdateByType<'updatePollAnswer'>;

export async function handleUpdatePollAnswer(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWirePollAnswerUpdate
): Promise<void> {
  await replaceTelegramPollAnswerOptions(database, update);
  events.publishTelegramPollAnswerUpdated(update);
}
