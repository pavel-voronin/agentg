import {
  registerModuleCapabilities,
  registerModuleExtensions,
  type ModuleRuntimeConfig
} from '@agentg/shared/modules/runtime';
import type {
  CapabilityRegistrationInput,
  CapabilityRegistrationOutput
} from '@agentg/shared/rpc/capabilities';
import type {
  ExtensionRegistrationInput,
  ExtensionRegistrationOutput
} from '@agentg/shared/rpc/extensions';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { HistoryRouter } from '@agentg/history-sync/rpc';
import { WebSocket, type RawData } from 'ws';

type JsonRpcResponse = {
  error?: {
    code: string;
    message: string;
  };
  id: number | string | null;
  result?: unknown;
};

export async function registerSummariesCapabilities(
  config: ModuleRuntimeConfig,
  gatewayUrl: string
): Promise<CapabilityRegistrationOutput[]> {
  return registerModuleCapabilities(config, {
    registerCapability(input) {
      return registerGatewayCapability(gatewayUrl, input);
    }
  });
}

export async function registerSummariesExtensions(
  config: ModuleRuntimeConfig,
  historyUrl: string
): Promise<ExtensionRegistrationOutput[]> {
  const client = createTRPCClient<HistoryRouter>({
    links: [
      httpBatchLink({
        url: historyUrl
      })
    ]
  });

  return registerModuleExtensions(config, {
    async registerExtension(input: ExtensionRegistrationInput) {
      return client.registerExtension.mutate(input);
    }
  });
}

async function registerGatewayCapability(
  gatewayUrl: string,
  input: CapabilityRegistrationInput
): Promise<CapabilityRegistrationOutput> {
  const response = await callGateway(gatewayUrl, 'capabilities.register', input);
  return response as CapabilityRegistrationOutput;
}

async function callGateway(url: string, method: string, params: unknown): Promise<unknown> {
  const socket = new WebSocket(url);
  const id = `req_${randomUUID()}`;

  return new Promise((resolve, reject) => {
    const closeWithRejection = (error: Error): void => {
      socket.close();
      reject(error);
    };

    socket.once('open', () => {
      socket.send(
        JSON.stringify({
          id,
          method,
          params
        })
      );
    });
    socket.once('error', (error) => {
      reject(error);
    });
    socket.once('message', (payload) => {
      try {
        const response = parseJsonRpcResponse(rawDataToString(payload));
        if (response.id !== id) {
          closeWithRejection(new Error(`Unexpected Gateway response id: ${String(response.id)}`));
          return;
        }
        if (response.error !== undefined) {
          closeWithRejection(new Error(response.error.message));
          return;
        }

        socket.close();
        resolve(response.result);
      } catch (error) {
        closeWithRejection(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}

function rawDataToString(payload: RawData): string {
  if (typeof payload === 'string') {
    return payload;
  }

  if (Buffer.isBuffer(payload)) {
    return payload.toString('utf8');
  }

  if (Array.isArray(payload)) {
    return Buffer.concat(payload).toString('utf8');
  }

  return Buffer.from(payload).toString('utf8');
}

function parseJsonRpcResponse(payload: string): JsonRpcResponse {
  const parsed = JSON.parse(payload) as unknown;
  const record = asRecord(parsed);
  if (record === undefined) {
    throw new Error('Gateway response must be an object');
  }

  const id = record.id;
  if (typeof id !== 'string' && typeof id !== 'number' && id !== null) {
    throw new Error('Gateway response id must be string, number, or null');
  }

  const errorRecord = asRecord(record.error);
  const error =
    errorRecord === undefined
      ? undefined
      : {
          code: typeof errorRecord.code === 'string' ? errorRecord.code : 'unknown',
          message: typeof errorRecord.message === 'string' ? errorRecord.message : ''
        };

  return {
    ...(error === undefined ? {} : { error }),
    id,
    ...(Object.hasOwn(record, 'result') ? { result: record.result } : {})
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
import { randomUUID } from 'node:crypto';
