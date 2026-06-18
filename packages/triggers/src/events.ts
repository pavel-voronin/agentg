import type { EventBus, JsonValue } from '@agentg/framework';

import type { OccurrenceStatus } from './schema.js';

export const TRIGGER_REGISTRATION_CHANGED_EVENT = 'triggers.registration.changed';
export const TRIGGER_OCCURRENCE_SCHEDULED_EVENT = 'triggers.occurrence.scheduled';
export const TRIGGER_OCCURRENCE_DISPATCHING_EVENT = 'triggers.occurrence.dispatching';
export const TRIGGER_OCCURRENCE_ACCEPTED_EVENT = 'triggers.occurrence.accepted';
export const TRIGGER_OCCURRENCE_REJECTED_EVENT = 'triggers.occurrence.rejected';
export const TRIGGER_OCCURRENCE_RETRY_WAITING_EVENT = 'triggers.occurrence.retryWaiting';
export const TRIGGER_OCCURRENCE_FAILED_EVENT = 'triggers.occurrence.failed';

export type TriggerEventPublisher = {
  occurrence(input: TriggerOccurrenceEventInput): void;
  registration(input: TriggerRegistrationEventInput): void;
};

type TriggerRegistrationEventInput = {
  actionModule: string;
  actionProcedure: string;
  registrationKey: string;
  ruleName: string;
};

type TriggerOccurrenceEventInput = TriggerRegistrationEventInput & {
  failureCode?: string | undefined;
  occurrenceKey: string;
  providerRunId?: string | undefined;
  scheduledAt: string;
  status: OccurrenceStatus;
};

export function createTriggerEventPublisher(events: EventBus): TriggerEventPublisher {
  return {
    occurrence(input) {
      const type = occurrenceEventType(input.status);
      if (type === null) {
        return;
      }
      events.publish(type, eventData(input));
    },
    registration(input) {
      events.publish(TRIGGER_REGISTRATION_CHANGED_EVENT, eventData(input));
    }
  };
}

function occurrenceEventType(status: OccurrenceStatus): string | null {
  switch (status) {
    case 'scheduled':
      return TRIGGER_OCCURRENCE_SCHEDULED_EVENT;
    case 'dispatching':
      return TRIGGER_OCCURRENCE_DISPATCHING_EVENT;
    case 'accepted':
      return TRIGGER_OCCURRENCE_ACCEPTED_EVENT;
    case 'rejected':
      return TRIGGER_OCCURRENCE_REJECTED_EVENT;
    case 'retryWaiting':
      return TRIGGER_OCCURRENCE_RETRY_WAITING_EVENT;
    case 'failed':
      return TRIGGER_OCCURRENCE_FAILED_EVENT;
    case 'cancelled':
    case 'claimed':
      return null;
  }
}

function eventData(input: TriggerRegistrationEventInput | TriggerOccurrenceEventInput): JsonValue {
  return {
    actionModule: input.actionModule,
    actionProcedure: input.actionProcedure,
    registrationKey: input.registrationKey,
    ruleName: input.ruleName,
    ...('occurrenceKey' in input
      ? {
          occurrenceKey: input.occurrenceKey,
          scheduledAt: input.scheduledAt,
          status: input.status
        }
      : {}),
    ...('failureCode' in input && input.failureCode !== undefined
      ? { failureCode: input.failureCode }
      : {}),
    ...('providerRunId' in input && input.providerRunId !== undefined
      ? { providerRunId: input.providerRunId }
      : {})
  };
}
