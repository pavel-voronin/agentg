import { toJsonValue, type EventBus, type JsonValue } from '@agentg/framework';

import type { ContentRef, SourceRef, TriggerProvenance } from './schema.js';

export const RUN_ACCEPTED_EVENT = 'llmRunner.run.accepted';
export const RUN_WAITING_FOR_SOURCE_EVENT = 'llmRunner.run.waitingForSource';
export const RUN_PROCESSING_EVENT = 'llmRunner.run.processing';
export const RUN_COMPLETED_EVENT = 'llmRunner.run.completed';
export const RUN_FAILED_EVENT = 'llmRunner.run.failed';
export const ARTIFACT_UPDATED_EVENT = 'llmRunner.artifact.updated';

export type RunEventInput = {
  artifactKey: string;
  contentRefs?: readonly ContentRef[] | undefined;
  failureCode?: string | undefined;
  runId: string;
  sourceRefs?: readonly SourceRef[] | undefined;
  trigger?: TriggerProvenance | undefined;
};

export type ArtifactEventInput = {
  artifactId: string;
  artifactKey: string;
  contentRefs: readonly ContentRef[];
  runId: string;
  sourceRefs: readonly SourceRef[];
  trigger?: TriggerProvenance | undefined;
};

export type EventPublisher = {
  artifactUpdated(input: ArtifactEventInput): void;
  runAccepted(input: RunEventInput): void;
  runCompleted(input: RunEventInput): void;
  runFailed(input: RunEventInput): void;
  runProcessing(input: RunEventInput): void;
  runWaitingForSource(input: RunEventInput): void;
};

export function createEventPublisher(events: EventBus): EventPublisher {
  return {
    artifactUpdated(input) {
      events.publish(ARTIFACT_UPDATED_EVENT, eventData(input));
    },
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
    },
    runWaitingForSource(input) {
      events.publish(RUN_WAITING_FOR_SOURCE_EVENT, eventData(input));
    }
  };
}

function eventData(input: RunEventInput | ArtifactEventInput): JsonValue {
  return toJsonValue({
    artifactKey: input.artifactKey,
    ...('artifactId' in input ? { artifactId: input.artifactId } : {}),
    ...('contentRefs' in input && input.contentRefs !== undefined
      ? { contentRefs: input.contentRefs }
      : {}),
    ...('failureCode' in input && input.failureCode !== undefined
      ? { failureCode: input.failureCode }
      : {}),
    runId: input.runId,
    ...('sourceRefs' in input && input.sourceRefs !== undefined
      ? { sourceRefs: input.sourceRefs }
      : {}),
    ...(input.trigger === undefined ? {} : { trigger: input.trigger })
  });
}
