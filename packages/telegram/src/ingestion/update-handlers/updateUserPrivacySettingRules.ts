import { upsertUserPrivacySettingRules } from '../../store/userPrivacySettingRules.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type UserPrivacySettingRulesUpdate = UpdateByType<'updateUserPrivacySettingRules'>;

export async function handleUpdateUserPrivacySettingRules(
  update: UserPrivacySettingRulesUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  await upsertUserPrivacySettingRules(database, update);
  await events.publishTelegramUserPrivacySettingRulesUpdated(update);
}
