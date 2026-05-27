import { inArray } from 'drizzle-orm';

import type { JsonValue } from '@agentg/events/json';

import type { TelegramDatabase } from '../database.js';
import { telegramSuggestedActions } from '../schema.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireSuggestedActionsUpdate = TelegramWireUpdateByType<'updateSuggestedActions'>;
type TelegramWireSuggestedAction = TelegramWireSuggestedActionsUpdate['added_actions'][number];
type TelegramSuggestedActionRow = typeof telegramSuggestedActions.$inferInsert;

export async function applySuggestedActionsDelta(
  database: TelegramDatabase,
  update: TelegramWireSuggestedActionsUpdate
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

function suggestedActionRow(action: TelegramWireSuggestedAction): TelegramSuggestedActionRow {
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
        description: requiredTelegramWireJsonValue(action.description),
        name: action.name,
        title: requiredTelegramWireJsonValue(action.title),
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

function suggestedActionKey(action: TelegramWireSuggestedAction): string {
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

function requiredTelegramWireJsonValue(value: unknown): JsonValue {
  const json = telegramWireJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}

function assertNeverSuggestedAction(action: never): never {
  throw new Error(`Unsupported suggested action: ${(action as { _: string })._}`);
}
