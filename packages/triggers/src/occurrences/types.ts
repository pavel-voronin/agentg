import type { TriggerAction } from '../../policies/policies.js';
import type { OccurrenceStatus } from '../schema.js';

export type TriggerOccurrence = Readonly<{
  action: TriggerAction;
  attemptCount: number;
  failureCode?: string | undefined;
  failureMessage?: string | undefined;
  key: string;
  leaseExpiresAt?: Date | undefined;
  leaseOwner?: string | undefined;
  nextAttemptAt: Date;
  providerRunId?: string | undefined;
  registrationKey: string;
  ruleName: string;
  scheduledAt: Date;
  status: OccurrenceStatus;
}>;

export type TriggerOccurrenceView = Readonly<{
  actionModule: string;
  actionProcedure: string;
  attemptCount: number;
  failureCode?: string | undefined;
  failureMessage?: string | undefined;
  key: string;
  nextAttemptAt: string;
  providerRunId?: string | undefined;
  registrationKey: string;
  ruleName: string;
  scheduledAt: string;
  status: OccurrenceStatus;
}>;

export function occurrenceKey(input: { registrationKey: string; scheduledAt: Date }): string {
  return `${input.registrationKey}:${input.scheduledAt.toISOString()}`;
}

export function occurrenceView(occurrence: TriggerOccurrence): TriggerOccurrenceView {
  return {
    actionModule: occurrence.action.module,
    actionProcedure: occurrence.action.procedure,
    attemptCount: occurrence.attemptCount,
    ...(occurrence.failureCode === undefined ? {} : { failureCode: occurrence.failureCode }),
    ...(occurrence.failureMessage === undefined
      ? {}
      : { failureMessage: occurrence.failureMessage }),
    key: occurrence.key,
    nextAttemptAt: occurrence.nextAttemptAt.toISOString(),
    ...(occurrence.providerRunId === undefined ? {} : { providerRunId: occurrence.providerRunId }),
    registrationKey: occurrence.registrationKey,
    ruleName: occurrence.ruleName,
    scheduledAt: occurrence.scheduledAt.toISOString(),
    status: occurrence.status
  };
}
