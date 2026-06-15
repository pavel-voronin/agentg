import { upsertUserPrivacySettingRules } from '../../store/userPrivacySettingRules.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type UserPrivacySettingRulesUpdate = UpdateByType<'updateUserPrivacySettingRules'>;

export async function handleUpdateUserPrivacySettingRules(
  update: UserPrivacySettingRulesUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await upsertUserPrivacySettingRules(database, update);
}
