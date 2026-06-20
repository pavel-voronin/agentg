import type { JsonValue } from '@agentg/framework';

export type TriggerAction = Readonly<{
  input: JsonValue;
  module: string;
  procedure: string;
}>;

export type TriggerCondition = Readonly<{
  everySeconds: number;
  kind: 'periodic';
  startAt?: string | undefined;
}>;

export type RegistrationOwner = Readonly<{
  key: string;
  module: string;
}>;

export type TriggerRegistrationInput = Readonly<{
  action: TriggerAction;
  condition: TriggerCondition;
  name: string;
}>;

export type TriggerRegistration = Readonly<{
  action: TriggerAction;
  anchorAt: Date;
  key: string;
  name: string;
  owner: RegistrationOwner;
  schedule: TriggerCondition;
}>;

export type TriggerRegistrationView = Readonly<{
  action: TriggerAction;
  anchorAt: string;
  key: string;
  name: string;
  owner: RegistrationOwner;
  schedule: TriggerCondition;
}>;

export function registrationKey(input: { name: string; owner: RegistrationOwner }): string {
  return [input.owner.module, input.owner.key, input.name].map(encodeComponent).join(':');
}

export function registrationFromInput(
  input: TriggerRegistrationInput,
  owner: RegistrationOwner,
  anchorAt: Date
): TriggerRegistration {
  return {
    action: input.action,
    anchorAt,
    key: registrationKey({ name: input.name, owner }),
    name: input.name,
    owner,
    schedule: input.condition
  };
}

export function registrationView(registration: TriggerRegistration): TriggerRegistrationView {
  return {
    ...registration,
    anchorAt: registration.anchorAt.toISOString()
  };
}

function encodeComponent(value: string): string {
  return encodeURIComponent(value);
}
