import { applySuggestedActionsDelta } from '../telegram-store/suggestedAction.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireSuggestedActionsUpdate = TelegramWireUpdateByType<'updateSuggestedActions'>;

export async function handleUpdateSuggestedActions(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireSuggestedActionsUpdate
): Promise<void> {
  await applySuggestedActionsDelta(database, update);
  events.publishTelegramSuggestedActionsUpdated(update);
}
