import { createLogger, logError } from '@agentg/framework';

import type { Dispatcher, DispatchOutcome } from './dispatcher/dispatcher.js';
import type { TriggerEventPublisher } from './events.js';
import type { TriggerOccurrence } from './occurrences/types.js';
import { occurrenceView } from './occurrences/types.js';
import type { TriggerRegistration, TriggerRegistrationView } from './registrations/types.js';
import { registrationView } from './registrations/types.js';
import { dueTimes } from './scheduler/scheduler.js';
import type {
  ListOccurrencesInput,
  ListRegistrationsInput,
  ReplaceRegistrationsInput
} from './schema.js';
import type { TriggerStore } from './store.js';
import {
  recordDispatch,
  recordOccurrencesCreated,
  recordTriggerStats,
  timeTriggerDispatch,
  timeTriggerRuntime
} from './telemetry.js';

const logger = createLogger('triggers');
const defaultClaimLimit = 50;

export type TriggerRuntime = {
  listOccurrences(input?: ListOccurrencesInput): Promise<{
    occurrences: ReturnType<typeof occurrenceView>[];
  }>;
  listTriggerRegistrations(input?: ListRegistrationsInput): Promise<{
    registrations: TriggerRegistrationView[];
  }>;
  replaceRegistrations(
    input: ReplaceRegistrationsInput,
    now?: Date
  ): Promise<{
    registrations: TriggerRegistrationView[];
  }>;
  reconcile(now?: Date): Promise<void>;
  runDueTriggers(now?: Date): Promise<{
    claimed: number;
    dispatched: number;
  }>;
};

export function createTriggerRuntime(input: {
  dispatcher: Dispatcher;
  events: TriggerEventPublisher;
  leaseOwner: string;
  leaseSeconds: number;
  lookbackSeconds: number;
  maxDispatchAttempts: number;
  store: TriggerStore;
}): TriggerRuntime {
  let queue = Promise.resolve();

  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.catch(() => undefined).then(operation);
    queue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  return {
    async listOccurrences(rawInput) {
      return {
        occurrences: (await input.store.listOccurrences(rawInput)).map(occurrenceView)
      };
    },
    async listTriggerRegistrations(rawInput) {
      return {
        registrations: (await input.store.listRegistrations(rawInput)).map(registrationView)
      };
    },
    replaceRegistrations(rawInput, now = new Date()) {
      return serialize(async () => {
        const previous = new Map(
          (await input.store.listRegistrations({ owner: rawInput.owner })).map((registration) => [
            registration.key,
            registration
          ])
        );
        const registrations = await input.store.replaceRegistrations({
          now,
          owner: rawInput.owner,
          registrations: rawInput.registrations
        });
        const current = new Map(
          registrations.map((registration) => [registration.key, registration])
        );
        for (const registration of registrations) {
          if (!sameRegistration(previous.get(registration.key), registration)) {
            input.events.registration(registrationEvent(registration, 'upserted'));
          }
        }
        for (const registration of previous.values()) {
          if (!current.has(registration.key)) {
            input.events.registration(registrationEvent(registration, 'removed'));
          }
        }
        await refreshStats(input.store, now);
        return {
          registrations: registrations.map(registrationView)
        };
      });
    },
    reconcile(now = new Date()) {
      return serialize(() =>
        timeTriggerRuntime('reconcile', async () => {
          const registrations = await input.store.listRegistrations();
          const created = await input.store.createOccurrences({
            now,
            registrations: dueRegistrations({
              lookbackSeconds: input.lookbackSeconds,
              now,
              registrations
            })
          });
          recordOccurrencesCreated(created.length);
          for (const occurrence of created) {
            input.events.occurrence(occurrenceEvent(occurrence, 'scheduled'));
          }
          await refreshStats(input.store, now);
        })
      );
    },
    runDueTriggers(now = new Date()) {
      return serialize(() =>
        timeTriggerRuntime('run_due', async () => {
          const registrations = await input.store.listRegistrations();
          const created = await input.store.createOccurrences({
            now,
            registrations: dueRegistrations({
              lookbackSeconds: input.lookbackSeconds,
              now,
              registrations
            })
          });
          recordOccurrencesCreated(created.length);
          for (const occurrence of created) {
            input.events.occurrence(occurrenceEvent(occurrence, 'scheduled'));
          }

          const claimed = await input.store.claimDue({
            leaseOwner: input.leaseOwner,
            leaseSeconds: input.leaseSeconds,
            limit: defaultClaimLimit,
            now
          });
          let dispatched = 0;
          for (const occurrence of claimed) {
            await dispatchOccurrence(input, occurrence, now);
            dispatched += 1;
          }
          return {
            claimed: claimed.length,
            dispatched
          };
        }).finally(() => refreshStats(input.store, now))
      );
    }
  };
}

async function refreshStats(store: TriggerStore, now: Date): Promise<void> {
  try {
    recordTriggerStats(await store.readStats({ now }));
  } catch (error) {
    logger.error(
      {
        event: 'triggers.telemetry_stats_failed',
        ...logError(error)
      },
      'trigger telemetry stats failed'
    );
  }
}

export function startTriggerRuntimeLoop(input: {
  intervalMs: number;
  runtime: Pick<TriggerRuntime, 'runDueTriggers'>;
}): () => Promise<undefined> {
  let active = true;
  let currentTick: Promise<undefined> | undefined;
  const tick = () => {
    if (!active || currentTick !== undefined) {
      return;
    }
    currentTick = runTick(input.runtime).finally(() => {
      currentTick = undefined;
    });
  };

  tick();
  const timer = setInterval(() => {
    tick();
  }, input.intervalMs);
  timer.unref();

  return async () => {
    active = false;
    clearInterval(timer);
    await currentTick;
    return undefined;
  };
}

async function runTick(runtime: Pick<TriggerRuntime, 'runDueTriggers'>): Promise<undefined> {
  try {
    await runtime.runDueTriggers();
  } catch (error) {
    logger.error(
      {
        event: 'triggers.scheduler_failed',
        ...logError(error)
      },
      'trigger scheduler failed'
    );
  }
  return undefined;
}

async function dispatchOccurrence(
  input: {
    dispatcher: Dispatcher;
    events: TriggerEventPublisher;
    maxDispatchAttempts: number;
    store: TriggerStore;
  },
  occurrence: TriggerOccurrence,
  now: Date
): Promise<void> {
  await input.store.markDispatching({ key: occurrence.key, now });
  input.events.occurrence(occurrenceEvent(occurrence, 'dispatching'));

  const outcome = await timeTriggerDispatch(() => input.dispatcher.dispatch(occurrence));
  const attemptNumber = occurrence.attemptCount + 1;
  if (outcome.status === 'result') {
    await recordProviderResult(input, occurrence, outcome, now);
    return;
  }

  if (outcome.failure.retryable && attemptNumber < input.maxDispatchAttempts) {
    await input.store.markRetryWaiting({
      code: outcome.failure.code,
      key: occurrence.key,
      message: outcome.failure.message,
      nextAttemptAt: retryAt(now, attemptNumber),
      now
    });
    recordDispatch('retry_waiting');
    input.events.occurrence(
      occurrenceEvent(occurrence, 'retryWaiting', {
        failureCode: outcome.failure.code
      })
    );
    return;
  }

  await input.store.markFailed({
    code: outcome.failure.code,
    key: occurrence.key,
    message: outcome.failure.message,
    now
  });
  recordDispatch('failed');
  input.events.occurrence(
    occurrenceEvent(occurrence, 'failed', {
      failureCode: outcome.failure.code
    })
  );
}

async function recordProviderResult(
  input: {
    events: TriggerEventPublisher;
    store: TriggerStore;
  },
  occurrence: TriggerOccurrence,
  outcome: Extract<DispatchOutcome, { status: 'result' }>,
  now: Date
): Promise<void> {
  if (outcome.result.status === 'accepted') {
    await input.store.markAccepted({
      key: occurrence.key,
      now,
      providerRunId: outcome.result.runId
    });
    recordDispatch('accepted');
    input.events.occurrence(
      occurrenceEvent(occurrence, 'accepted', {
        providerRunId: outcome.result.runId
      })
    );
    return;
  }

  await input.store.markRejected({
    code: outcome.result.error.code,
    key: occurrence.key,
    message: outcome.result.error.message,
    now
  });
  recordDispatch('rejected');
  input.events.occurrence(
    occurrenceEvent(occurrence, 'rejected', {
      failureCode: outcome.result.error.code
    })
  );
}

function dueRegistrations(input: {
  lookbackSeconds: number;
  now: Date;
  registrations: readonly TriggerRegistration[];
}): { registration: TriggerRegistration; scheduledAt: Date }[] {
  return input.registrations.flatMap((registration) =>
    dueTimes({
      lookbackSeconds: input.lookbackSeconds,
      now: input.now,
      registration
    }).map((scheduledAt) => ({
      registration,
      scheduledAt
    }))
  );
}

function occurrenceEvent(
  occurrence: TriggerOccurrence,
  status: TriggerOccurrence['status'],
  extra: {
    failureCode?: string | undefined;
    providerRunId?: string | undefined;
  } = {}
) {
  return {
    actionModule: occurrence.action.module,
    actionProcedure: occurrence.action.procedure,
    failureCode: extra.failureCode,
    occurrenceKey: occurrence.key,
    providerRunId: extra.providerRunId,
    registrationName: occurrence.registrationName,
    registrationKey: occurrence.registrationKey,
    scheduledAt: occurrence.scheduledAt.toISOString(),
    status
  };
}

function registrationEvent(registration: TriggerRegistration, operation: 'removed' | 'upserted') {
  return {
    actionModule: registration.action.module,
    actionProcedure: registration.action.procedure,
    operation,
    owner: registration.owner,
    registrationKey: registration.key,
    registrationName: registration.name
  };
}

function sameRegistration(
  left: TriggerRegistration | undefined,
  right: TriggerRegistration
): boolean {
  return (
    left?.anchorAt.getTime() === right.anchorAt.getTime() &&
    JSON.stringify(left.action) === JSON.stringify(right.action) &&
    JSON.stringify(left.owner) === JSON.stringify(right.owner) &&
    left.name === right.name &&
    JSON.stringify(left.schedule) === JSON.stringify(right.schedule)
  );
}

function retryAt(now: Date, attemptNumber: number): Date {
  return new Date(now.getTime() + Math.min(30, attemptNumber) * 1000);
}
