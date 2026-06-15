import type { JsonValue } from '@agentg/framework';

import type { DomainChange, SuggestedActionsDeltaAppliedChange } from '../../domain/changes.js';
import type { SuggestedAction } from '../../domain/models/suggestedAction.js';
import { tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';

type SuggestedActionsUpdate = UpdateByType<'updateSuggestedActions'>;
type TdlibSuggestedAction = SuggestedActionsUpdate['added_actions'][number];

export function suggestedActionsChanges(update: SuggestedActionsUpdate): DomainChange[] {
  return [
    {
      kind: 'suggestedActionsDelta.applied',
      input: {
        addedActions: update.added_actions.map(suggestedActionRecord),
        removedActionKeys: update.removed_actions.map(suggestedActionKey)
      }
    } satisfies SuggestedActionsDeltaAppliedChange
  ];
}

function suggestedActionRecord(action: TdlibSuggestedAction): SuggestedAction {
  const record: SuggestedAction = {
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
        ...record,
        description: requiredJsonValue(action.description),
        name: action.name,
        title: requiredJsonValue(action.title),
        url: action.url
      };
    case 'suggestedActionConvertToBroadcastGroup':
      return { ...record, supergroupId: String(action.supergroup_id) };
    case 'suggestedActionSetPassword':
      return { ...record, authorizationDelay: action.authorization_delay };
    case 'suggestedActionExtendPremium':
      return {
        ...record,
        managePremiumSubscriptionUrl: action.manage_premium_subscription_url
      };
    case 'suggestedActionSetLoginEmailAddress':
      return { ...record, canBeHidden: action.can_be_hidden };
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
      return record;
  }

  return assertNeverSuggestedAction(action);
}

function suggestedActionKey(action: TdlibSuggestedAction): string {
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
