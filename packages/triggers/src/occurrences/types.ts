import type { TriggerAction } from '../registrations/types.js';
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
  registrationName: string;
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
  registrationName: string;
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
    registrationName: occurrence.registrationName,
    scheduledAt: occurrence.scheduledAt.toISOString(),
    status: occurrence.status
  };
}
