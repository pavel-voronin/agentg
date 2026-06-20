import { toJsonValue, type EventBus, type JsonValue } from '@agentg/framework';

const RUN_ACCEPTED_EVENT = 'llmRunner.run.accepted';
const RUN_PROCESSING_EVENT = 'llmRunner.run.processing';
const RUN_COMPLETED_EVENT = 'llmRunner.run.completed';
const RUN_FAILED_EVENT = 'llmRunner.run.failed';

export type RunEventInput = {
  failureCode?: string | undefined;
  nodeId: string;
  profile: string;
  runId: string;
  pipelineRunId: string;
  status: 'accepted' | 'completed' | 'failed' | 'processing';
};

export type EventPublisher = {
  runAccepted(input: RunEventInput): void;
  runCompleted(input: RunEventInput): void;
  runFailed(input: RunEventInput): void;
  runProcessing(input: RunEventInput): void;
};

export function createEventPublisher(events: EventBus): EventPublisher {
  return {
    runAccepted(input) {
      events.publish(RUN_ACCEPTED_EVENT, eventData(input));
    },
    runCompleted(input) {
      events.publish(RUN_COMPLETED_EVENT, eventData(input));
    },
    runFailed(input) {
      events.publish(RUN_FAILED_EVENT, eventData(input));
    },
    runProcessing(input) {
      events.publish(RUN_PROCESSING_EVENT, eventData(input));
    }
  };
}

function eventData(input: RunEventInput): JsonValue {
  return toJsonValue(input);
}
