import { upsertUserPrivacySettingRules } from '../../store/userPrivacySettingRules.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireUserPrivacySettingRulesUpdate =
  TelegramWireUpdateByType<'updateUserPrivacySettingRules'>;

export async function handleUpdateUserPrivacySettingRules(
  update: TelegramWireUserPrivacySettingRulesUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await upsertUserPrivacySettingRules(database, update);
  events.publishTelegramUserPrivacySettingRulesUpdated(update);
}
