import type { TriggerAction, TriggerCondition, TriggerRule } from '../../policies/policies.js';

export type TriggerRegistration = Readonly<{
  action: TriggerAction;
  anchorAt: Date;
  key: string;
  rule: {
    kind: 'TriggerRule';
    name: string;
  };
  schedule: TriggerCondition;
}>;

export type TriggerRegistrationView = Readonly<{
  action: TriggerAction;
  anchorAt: string;
  key: string;
  rule: {
    kind: 'TriggerRule';
    name: string;
  };
  schedule: TriggerCondition;
}>;

export function registrationKey(rule: TriggerRule): string {
  return `TriggerRule:${rule.name}`;
}

export function registrationFromRule(
  rule: TriggerRule,
  anchorAt: Date = new Date()
): TriggerRegistration {
  return {
    action: rule.spec.action,
    anchorAt,
    key: registrationKey(rule),
    rule: {
      kind: 'TriggerRule',
      name: rule.name
    },
    schedule: rule.spec.condition
  };
}

export function registrationView(registration: TriggerRegistration): TriggerRegistrationView {
  return {
    ...registration,
    anchorAt: registration.anchorAt.toISOString()
  };
}
