import { applySuggestedActionsDelta } from '../../store/suggestedAction.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireSuggestedActionsUpdate = TelegramWireUpdateByType<'updateSuggestedActions'>;

export async function handleUpdateSuggestedActions(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireSuggestedActionsUpdate
): Promise<void> {
  await applySuggestedActionsDelta(database, update);
  events.publishTelegramSuggestedActionsUpdated(update);
}
