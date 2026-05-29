import { replaceTermsOfService } from '../../store/termsOfService.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireTermsOfServiceUpdate = TelegramWireUpdateByType<'updateTermsOfService'>;

export async function handleUpdateTermsOfService(
  update: TelegramWireTermsOfServiceUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await replaceTermsOfService(database, update);
  events.publishTelegramTermsOfServiceRequired(update);
}
