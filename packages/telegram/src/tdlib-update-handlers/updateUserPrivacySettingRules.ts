import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertUserPrivacySettingRules } from '../telegram-store/userPrivacySettingRules.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireUserPrivacySettingRulesUpdate =
  TelegramWireUpdateByType<'updateUserPrivacySettingRules'>;

export async function handleUpdateUserPrivacySettingRules(
  context: TelegramUpdateHandlerContext,
  update: TelegramWireUserPrivacySettingRulesUpdate
): Promise<void> {
  await upsertUserPrivacySettingRules(context.database, update);
  context.events.publishTelegramUserPrivacySettingRulesUpdated(update);
}
