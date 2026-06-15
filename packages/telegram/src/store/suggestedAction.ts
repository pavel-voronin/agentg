import { inArray } from 'drizzle-orm';

import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramSuggestedActions } from '../database/schema.js';
import { tdJsonValue, type UpdateByType } from '../tdlib/shape.js';

type SuggestedActionsUpdate = UpdateByType<'updateSuggestedActions'>;
type SuggestedAction = SuggestedActionsUpdate['added_actions'][number];
type TelegramSuggestedActionRow = typeof telegramSuggestedActions.$inferInsert;

export async function applySuggestedActionsDelta(
  database: Database,
  update: SuggestedActionsUpdate
): Promise<void> {
  const removedActionKeys = [...new Set(update.removed_actions.map(suggestedActionKey))];

  await database.transaction(async (transaction) => {
    if (removedActionKeys.length > 0) {
      await transaction
        .delete(telegramSuggestedActions)
        .where(inArray(telegramSuggestedActions.actionKey, removedActionKeys));
    }

    for (const action of update.added_actions) {
      const row = suggestedActionRow(action);
      await transaction.insert(telegramSuggestedActions).values(row).onConflictDoUpdate({
        set: row,
        target: telegramSuggestedActions.actionKey
      });
    }
  });
}

function suggestedActionRow(action: SuggestedAction): TelegramSuggestedActionRow {
  const row: TelegramSuggestedActionRow = {
    actionKey: suggestedActionKey(action),
    authorizationDelay: null,
    canBeHidden: null,
    description: null,
    managePremiumSubscriptionUrl: null,
    name: null,
    supergroupId: null,
    title: null,
    url: null
  };

  switch (action._) {
    case 'suggestedActionCustom':
      return {
        ...row,
        description: requiredJsonValue(action.description),
        name: action.name,
        title: requiredJsonValue(action.title),
        url: action.url
      };
    case 'suggestedActionConvertToBroadcastGroup':
      return { ...row, supergroupId: String(action.supergroup_id) };
    case 'suggestedActionSetPassword':
      return { ...row, authorizationDelay: action.authorization_delay };
    case 'suggestedActionExtendPremium':
      return {
        ...row,
        managePremiumSubscriptionUrl: action.manage_premium_subscription_url
      };
    case 'suggestedActionSetLoginEmailAddress':
      return { ...row, canBeHidden: action.can_be_hidden };
    case 'suggestedActionAddLoginPasskey':
    case 'suggestedActionCheckPassword':
    case 'suggestedActionCheckPhoneNumber':
    case 'suggestedActionEnableArchiveAndMuteNewChats':
    case 'suggestedActionExtendStarSubscriptions':
    case 'suggestedActionGiftPremiumForChristmas':
    case 'suggestedActionRestorePremium':
    case 'suggestedActionSetBirthdate':
    case 'suggestedActionSetProfilePhoto':
    case 'suggestedActionSubscribeToAnnualPremium':
    case 'suggestedActionUpgradePremium':
    case 'suggestedActionViewChecksHint':
      return row;
  }

  return assertNeverSuggestedAction(action);
}

function suggestedActionKey(action: SuggestedAction): string {
  switch (action._) {
    case 'suggestedActionCustom':
      return `suggestedActionCustom:${action.name}`;
    case 'suggestedActionConvertToBroadcastGroup':
      return `suggestedActionConvertToBroadcastGroup:${String(action.supergroup_id)}`;
    case 'suggestedActionAddLoginPasskey':
    case 'suggestedActionCheckPassword':
    case 'suggestedActionCheckPhoneNumber':
    case 'suggestedActionEnableArchiveAndMuteNewChats':
    case 'suggestedActionExtendPremium':
    case 'suggestedActionExtendStarSubscriptions':
    case 'suggestedActionGiftPremiumForChristmas':
    case 'suggestedActionRestorePremium':
    case 'suggestedActionSetBirthdate':
    case 'suggestedActionSetLoginEmailAddress':
    case 'suggestedActionSetPassword':
    case 'suggestedActionSetProfilePhoto':
    case 'suggestedActionSubscribeToAnnualPremium':
    case 'suggestedActionUpgradePremium':
    case 'suggestedActionViewChecksHint':
      return action._;
  }

  return assertNeverSuggestedAction(action);
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}

function assertNeverSuggestedAction(action: never): never {
  throw new Error(`Unsupported suggested action: ${(action as { _: string })._}`);
}
