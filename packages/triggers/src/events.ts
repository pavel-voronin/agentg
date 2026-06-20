import type { EventBus, JsonValue } from '@agentg/framework';

import type { OccurrenceStatus } from './schema.js';
import type { RegistrationOwner } from './registrations/types.js';

const TRIGGER_REGISTRATION_CHANGED_EVENT = 'triggers.registration.changed';
const TRIGGER_OCCURRENCE_SCHEDULED_EVENT = 'triggers.occurrence.scheduled';
const TRIGGER_OCCURRENCE_DISPATCHING_EVENT = 'triggers.occurrence.dispatching';
const TRIGGER_OCCURRENCE_ACCEPTED_EVENT = 'triggers.occurrence.accepted';
const TRIGGER_OCCURRENCE_REJECTED_EVENT = 'triggers.occurrence.rejected';
const TRIGGER_OCCURRENCE_RETRY_WAITING_EVENT = 'triggers.occurrence.retryWaiting';
const TRIGGER_OCCURRENCE_FAILED_EVENT = 'triggers.occurrence.failed';

export type TriggerEventPublisher = {
  occurrence(input: TriggerOccurrenceEventInput): void;
  registration(input: TriggerRegistrationEventInput): void;
};

type TriggerRegistrationEventInput = {
  actionModule: string;
  actionProcedure: string;
  operation: 'removed' | 'upserted';
  owner: RegistrationOwner;
  registrationKey: string;
  registrationName: string;
};

type TriggerOccurrenceEventInput = {
  actionModule: string;
  actionProcedure: string;
  failureCode?: string | undefined;
  occurrenceKey: string;
  providerRunId?: string | undefined;
  registrationKey: string;
  registrationName: string;
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
    ...('operation' in input ? { operation: input.operation } : {}),
    ...('owner' in input ? { owner: input.owner } : {}),
    registrationKey: input.registrationKey,
    registrationName: input.registrationName,
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
