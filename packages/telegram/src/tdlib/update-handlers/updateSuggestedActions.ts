import { applySuggestedActionsDelta } from '../../store/suggestedAction.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireSuggestedActionsUpdate = TelegramWireUpdateByType<'updateSuggestedActions'>;

export async function handleUpdateSuggestedActions(
  update: TelegramWireSuggestedActionsUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await applySuggestedActionsDelta(database, update);
  events.publishTelegramSuggestedActionsUpdated(update);
}
