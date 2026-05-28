import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertUserPrivacySettingRules } from '../../store/userPrivacySettingRules.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireUserPrivacySettingRulesUpdate =
  TelegramWireUpdateByType<'updateUserPrivacySettingRules'>;

export async function handleUpdateUserPrivacySettingRules(
  context: TelegramUpdateHandlerContext,
  update: TelegramWireUserPrivacySettingRulesUpdate
): Promise<void> {
  await upsertUserPrivacySettingRules(context.database, update);
  context.events.publishTelegramUserPrivacySettingRulesUpdated(update);
}
