import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { userPrivacySettingRulesChanges } from '../settings.js';
import type { IngestionResources } from '../../resources.js';

type UserPrivacySettingRulesUpdate = UpdateByType<'updateUserPrivacySettingRules'>;

export async function handleUpdateUserPrivacySettingRules(
  update: UserPrivacySettingRulesUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, userPrivacySettingRulesChanges(update));
}
