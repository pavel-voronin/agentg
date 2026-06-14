import type { EventBus, EventSubscription } from '../events/eventBus.js';
import { logError } from '../log.js';
import type { PolicyClient } from './client.js';
import type { PolicyDefinition } from './definition.js';
import { assertPolicyValue } from './definition.js';
import type { PolicyResolvedValue } from './resolvers.js';
import {
  POLICY_INSTANCES_CHANGED_EVENT,
  type PolicyInstancesChanged,
  type PolicyValue
} from './types.js';

type LiveInput<TSpec, TValue extends PolicyResolvedValue> = {
  client: PolicyClient;
  definition: PolicyDefinition<TSpec, TValue>;
  events: EventBus;
  logger: {
    error(entry: Record<string, unknown>, message: string): void;
  };
  moduleName: string;
};

export type LivePolicyValue<TValue> = {
  read(): Readonly<TValue>;
  start(): Promise<() => undefined>;
};

export function createLivePolicyValue<TSpec, TValue extends PolicyResolvedValue>(
  input: LiveInput<TSpec, TValue>
): LivePolicyValue<TValue> {
  let current: PolicyValue | undefined;
  let refreshQueue = Promise.resolve();
  let subscription: EventSubscription | undefined;

  async function refresh(required: boolean): Promise<void> {
    try {
      current = assertPolicyValue(
        await input.client.getPolicyValue({ kind: input.definition.kind })
      );
    } catch (error) {
      if (required) {
        throw error;
      }
      input.logger.error(
        {
          event: 'policy.refetch_failed',
          kind: input.definition.kind,
          module: input.moduleName,
          ...logError(error)
        },
        'policy refetch failed'
      );
    }
  }

  function enqueueRefresh(required: boolean): Promise<void> {
    const next = refreshQueue.catch(() => undefined).then(() => refresh(required));
    refreshQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  return {
    read() {
      if (current === undefined) {
        throw new Error(`Policy ${input.definition.kind} was read before startup completed`);
      }
      return current as Readonly<TValue>;
    },
    async start() {
      subscription = input.events.subscribe(POLICY_INSTANCES_CHANGED_EVENT, (event) => {
        if (isChangedEvent(event.data) && event.data.kind === input.definition.kind) {
          void enqueueRefresh(false);
        }
      });

      try {
        await enqueueRefresh(true);
        await refreshQueue;
      } catch (error) {
        subscription.unsubscribe();
        subscription = undefined;
        throw error;
      }

      return () => {
        subscription?.unsubscribe();
        subscription = undefined;
        return undefined;
      };
    }
  };
}

function isChangedEvent(value: unknown): value is PolicyInstancesChanged {
  return (
    typeof value === 'object' && value !== null && 'kind' in value && typeof value.kind === 'string'
  );
}
