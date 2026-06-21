import { defineInternalRpcDomain } from '@agentg/framework';

import {
  providerResultSchema,
  providerRunResultSchema,
  type Dataset,
  type ProviderResult,
  type ProviderRunResult
} from './schema.js';

type GenericProcedures = Record<string, (input: unknown) => unknown>;

export type Dispatcher = {
  dispatch(input: {
    actionId: string;
    dataset: Dataset;
    nodeId: string;
    runId: string;
    withInput: unknown;
  }): Promise<ProviderResult>;
};

export type ResultReader = {
  read(input: { actionId: string; providerRunId: string }): Promise<ProviderRunResult>;
};

export function createRpcDispatcher(input: {
  readonly targets: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
}): Dispatcher {
  return {
    async dispatch(request) {
      let module: string;
      try {
        module = actionModule(request.actionId);
      } catch (error) {
        return rejected(
          'unknown_action_module',
          error instanceof Error ? error.message : String(error)
        );
      }
      try {
        const url = input.targets[module];
        if (url === undefined) {
          return rejected('unknown_action_module', `No action target configured for ${module}`);
        }
        const client = defineInternalRpcDomain<GenericProcedures>(module)({
          timeoutMs: input.timeoutMs,
          url
        });
        const procedure = client[request.actionId];
        if (procedure === undefined) {
          return rejected(
            'unknown_action_procedure',
            `Action procedure is not configured: ${request.actionId}`
          );
        }
        return providerResultSchema.parse(
          await procedure({
            input: request.dataset,
            node: {
              id: request.nodeId,
              runId: request.runId
            },
            with: request.withInput
          })
        );
      } catch (error) {
        return rejected(
          'action_dispatch_failed',
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  };
}

export function createRpcResultReader(input: {
  readonly targets: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
}): ResultReader {
  return {
    async read(request) {
      let module: string;
      try {
        module = actionModule(request.actionId);
      } catch (error) {
        return providerRunFailed(
          request.providerRunId,
          'unknown_action_module',
          error instanceof Error ? error.message : String(error)
        );
      }
      const procedureName = resultProcedure(request.actionId);
      if (procedureName === undefined) {
        return providerRunFailed(
          request.providerRunId,
          'unknown_result_procedure',
          `Action has no provider result reader: ${request.actionId}`
        );
      }
      try {
        const url = input.targets[module];
        if (url === undefined) {
          return providerRunFailed(
            request.providerRunId,
            'unknown_action_module',
            `No action target configured for ${module}`
          );
        }
        const client = defineInternalRpcDomain<GenericProcedures>(module)({
          timeoutMs: input.timeoutMs,
          url
        });
        const procedure = client[procedureName];
        if (procedure === undefined) {
          return providerRunFailed(
            request.providerRunId,
            'unknown_result_procedure',
            `Result procedure is not configured: ${procedureName}`
          );
        }
        const result = await procedure({ runId: request.providerRunId });
        if (result === null) {
          return providerRunFailed(
            request.providerRunId,
            'provider_result_not_found',
            `Provider result is not found: ${request.providerRunId}`
          );
        }
        return providerRunResultSchema.parse(result);
      } catch (error) {
        return providerRunFailed(
          request.providerRunId,
          'provider_result_read_failed',
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  };
}

function actionModule(actionId: string): string {
  if (actionId.startsWith('data.')) {
    return 'data';
  }
  if (actionId === 'llm.run') {
    return 'llm-runner';
  }
  throw new Error(`Unknown action id: ${actionId}`);
}

function resultProcedure(actionId: string): string | undefined {
  if (actionId === 'llm.run') {
    return 'getRunResult';
  }
  return undefined;
}

function rejected(code: string, message: string): ProviderResult {
  return {
    error: {
      code,
      message
    },
    status: 'rejected'
  };
}

function providerRunFailed(runId: string, code: string, message: string): ProviderRunResult {
  return {
    error: {
      code,
      message
    },
    runId,
    status: 'failed'
  };
}
