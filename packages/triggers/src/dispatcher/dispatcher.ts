import {
  defineInternalRpcDomain,
  isProcedureInfrastructureError,
  ProcedureTransportError
} from '@agentg/framework';

import type { TriggerOccurrence } from '../occurrences/types.js';
import {
  requireTriggeredActionResult,
  type TriggeredActionInput,
  type TriggeredActionResult
} from '../schema.js';

type GenericProcedures = Record<string, (input: unknown) => unknown>;

export type DispatchFailure = {
  code: string;
  message: string;
  retryable: boolean;
};

export type DispatchOutcome =
  | {
      result: TriggeredActionResult;
      status: 'result';
    }
  | {
      failure: DispatchFailure;
      status: 'failure';
    };

export type Dispatcher = {
  dispatch(occurrence: TriggerOccurrence): Promise<DispatchOutcome>;
};

export function createRpcDispatcher(input: {
  readonly targets: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
}): Dispatcher {
  return {
    async dispatch(occurrence) {
      const url = input.targets[occurrence.action.module];
      if (url === undefined) {
        return {
          failure: {
            code: 'unknown_action_module',
            message: `No trigger action target configured for ${occurrence.action.module}`,
            retryable: false
          },
          status: 'failure'
        };
      }

      try {
        const client = defineInternalRpcDomain<GenericProcedures>(occurrence.action.module)({
          timeoutMs: input.timeoutMs,
          url
        });
        const procedure = client[occurrence.action.procedure];
        if (procedure === undefined) {
          return {
            failure: {
              code: 'unknown_action_procedure',
              message: `Procedure target is not available: ${occurrence.action.procedure}`,
              retryable: false
            },
            status: 'failure'
          };
        }
        const result = await procedure(triggeredInput(occurrence));
        return {
          result: requireTriggeredActionResult(result),
          status: 'result'
        };
      } catch (error) {
        const failure = dispatchFailure(error);
        return {
          failure,
          status: 'failure'
        };
      }
    }
  };
}

function triggeredInput(occurrence: TriggerOccurrence): TriggeredActionInput {
  return {
    actionInput: occurrence.action.input,
    occurrence: {
      idempotencyKey: occurrence.key,
      registrationKey: occurrence.registrationKey,
      scheduledAt: occurrence.scheduledAt.toISOString()
    },
    trigger: {
      kind: 'trigger',
      requestId: occurrence.key
    }
  };
}

function dispatchFailure(error: unknown): DispatchFailure {
  const message = error instanceof Error ? error.message : String(error);
  if (isUnknownProcedureError(error)) {
    return {
      code: 'unknown_action_procedure',
      message,
      retryable: false
    };
  }
  return {
    code: dispatchErrorCode(error),
    message,
    retryable: isProcedureInfrastructureError(error)
  };
}

function dispatchErrorCode(error: unknown): string {
  return isProcedureInfrastructureError(error) ? error.code : 'procedure_result_invalid';
}

function isUnknownProcedureError(error: unknown): boolean {
  return (
    error instanceof Error &&
    !(error instanceof ProcedureTransportError) &&
    error.message.startsWith('Procedure is not registered:')
  );
}
