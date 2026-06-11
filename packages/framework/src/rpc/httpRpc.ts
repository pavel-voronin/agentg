import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { context, propagation, SpanKind, type TextMapGetter } from '@opentelemetry/api';
import {
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_RPC_METHOD,
  ATTR_RPC_SERVICE,
  ATTR_RPC_SYSTEM_NAME,
  METRIC_RPC_CLIENT_CALL_DURATION,
  METRIC_RPC_SERVER_CALL_DURATION,
  RPC_SYSTEM_NAME_VALUE_JSONRPC
} from '@opentelemetry/semantic-conventions/incubating';

import { timeTelemetrySpan, type TelemetryAttributes } from '../telemetry/index.js';
import type { MaybePromise, ProcedureMap } from '../types.js';
import type {
  InternalRpcDomain,
  ProcedureServer,
  ProcedureServerOptions,
  RpcClient,
  RpcFactory
} from './rpc.js';

type ProcedureCallOptions = {
  service: string;
  timeoutMs?: number | undefined;
};

const MAX_REQUEST_BODY_BYTES = 1_000_000;
const incomingHeadersGetter: TextMapGetter<IncomingMessage['headers']> = {
  get(carrier, key) {
    return firstString(carrier[key]);
  },
  keys(carrier) {
    return Object.keys(carrier);
  }
};

export function httpRpc(options: ProcedureServerOptions): RpcFactory {
  const service = rpcServiceName(options.service);
  return {
    start(procedures) {
      return startProcedureServer(procedures, { ...options, service });
    }
  };
}

export function defineInternalRpcDomain<TProcedures extends ProcedureMap>(
  serviceName: string
): InternalRpcDomain<TProcedures> {
  const service = rpcServiceName(serviceName);
  return (options) =>
    new Proxy(
      {},
      {
        get(_target, property) {
          if (property === 'then') {
            return undefined;
          }
          if (typeof property !== 'string') {
            return undefined;
          }

          return (input?: unknown) =>
            callProcedure(options.url, property, input, {
              service,
              timeoutMs: options.timeoutMs
            });
        }
      }
    ) as RpcClient<TProcedures>;
}

export class ProcedureTransportError extends Error {
  readonly code = 'procedure_transport_failed';

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ProcedureTransportError';
  }
}

export async function startProcedureServer(
  procedures: ProcedureMap,
  options: ProcedureServerOptions
): Promise<ProcedureServer> {
  const service = rpcServiceName(options.service);
  const server = createServer((request, response) => {
    const requestContext = propagation.extract(
      context.active(),
      request.headers,
      incomingHeadersGetter
    );
    void context.with(requestContext, () =>
      handleProcedureRequest(procedures, request, response, service)
    );
  });
  const host = options.host ?? '127.0.0.1';

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  return {
    url: serverUrl(server, host),
    stop() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error !== undefined) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}

export async function callProcedure<T>(
  url: string,
  procedure: string,
  input: unknown,
  options: ProcedureCallOptions
): Promise<T> {
  const controller = new AbortController();
  const endpoint = new URL(procedureEndpoint(url));
  const service = rpcServiceName(options.service);
  const attributes = rpcAttributes(procedure, service);
  const spanAttributes = {
    ...attributes,
    [ATTR_SERVER_ADDRESS]: endpoint.hostname,
    ...(endpoint.port.length === 0 ? {} : { [ATTR_SERVER_PORT]: Number(endpoint.port) })
  };
  const timeout =
    options.timeoutMs === undefined
      ? undefined
      : setTimeout(() => {
          controller.abort();
        }, options.timeoutMs);
  timeout?.unref();
  let response: Response;

  try {
    return await timeTelemetrySpan(
      {
        attributes: spanAttributes,
        kind: SpanKind.CLIENT,
        metric: {
          attributes,
          name: METRIC_RPC_CLIENT_CALL_DURATION
        },
        name: procedure
      },
      async () => {
        const headers = {
          'content-type': 'application/json'
        };
        propagation.inject(context.active(), headers);
        try {
          response = await fetch(endpoint, {
            body: JSON.stringify({
              input,
              procedure
            }),
            headers,
            method: 'POST',
            signal: controller.signal
          });
        } catch (error) {
          throw new ProcedureTransportError(
            controller.signal.aborted && options.timeoutMs !== undefined
              ? `Procedure call timed out after ${String(options.timeoutMs)}ms`
              : `Procedure transport failed: ${errorMessage(error)}`,
            { cause: error }
          );
        }
        const body: unknown = await response.json();
        if (!response.ok) {
          throw new Error(responseErrorMessage(body, response.status));
        }
        if (
          typeof body !== 'object' ||
          body === null ||
          !('ok' in body) ||
          body.ok !== true ||
          !('result' in body)
        ) {
          throw new Error('Procedure response is invalid');
        }

        return body.result as T;
      }
    );
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

async function handleProcedureRequest(
  procedures: ProcedureMap,
  request: IncomingMessage,
  response: ServerResponse,
  service: string
): Promise<void> {
  if (request.method !== 'POST' || request.url !== '/rpc') {
    writeJson(response, 404, {
      error: {
        code: 'not_found',
        message: 'Procedure endpoint is POST /rpc'
      },
      ok: false
    });
    return;
  }

  if (contentLengthExceedsLimit(request)) {
    request.resume();
    writeJson(response, 413, {
      error: {
        code: 'payload_too_large',
        message: `Procedure request body exceeds ${String(MAX_REQUEST_BODY_BYTES)} bytes`
      },
      ok: false
    });
    return;
  }

  try {
    const body = await readRequestBody(request);
    const envelope = requireProcedureEnvelope(JSON.parse(body) as unknown);
    const procedure = procedures[envelope.procedure];
    if (procedure === undefined) {
      writeJson(response, 404, {
        error: {
          code: 'procedure_not_found',
          message: `Procedure is not registered: ${envelope.procedure}`
        },
        ok: false
      });
      return;
    }

    const attributes = rpcAttributes(envelope.procedure, service);
    const result = await timeTelemetrySpan(
      {
        attributes,
        kind: SpanKind.SERVER,
        metric: {
          attributes,
          name: METRIC_RPC_SERVER_CALL_DURATION
        },
        name: envelope.procedure
      },
      () =>
        Promise.resolve((procedure as (input: unknown) => MaybePromise<unknown>)(envelope.input))
    );
    writeJson(response, 200, {
      ok: true,
      result
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      writeJson(response, 413, {
        error: {
          code: 'payload_too_large',
          message: `Procedure request body exceeds ${String(MAX_REQUEST_BODY_BYTES)} bytes`
        },
        ok: false
      });
      return;
    }

    writeJson(response, 400, {
      error: {
        code: 'procedure_failed',
        message: error instanceof Error ? error.message : String(error)
      },
      ok: false
    });
  }
}

function requireProcedureEnvelope(value: unknown): { input: unknown; procedure: string } {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('procedure' in value) ||
    typeof value.procedure !== 'string' ||
    value.procedure.trim() === ''
  ) {
    throw new Error('Procedure request must include procedure');
  }

  return {
    input: 'input' in value ? value.input : undefined,
    procedure: value.procedure
  };
}

function rpcAttributes(method: string, service: string): TelemetryAttributes {
  return {
    [ATTR_RPC_METHOD]: method,
    [ATTR_RPC_SERVICE]: service,
    [ATTR_RPC_SYSTEM_NAME]: RPC_SYSTEM_NAME_VALUE_JSONRPC
  };
}

function rpcServiceName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error('RPC service name is required');
  }
  return trimmed;
}

function contentLengthExceedsLimit(request: IncomingMessage): boolean {
  const headers = request.headers as Record<string, unknown>;
  const value = firstString(headers['content-length']);
  if (value === undefined) {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > MAX_REQUEST_BODY_BYTES;
}

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (!Array.isArray(value)) {
    return undefined;
  }

  const first: unknown = value[0];
  return typeof first === 'string' ? first : undefined;
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    let rejected = false;
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      if (rejected) {
        return;
      }
      bytes += Buffer.byteLength(chunk, 'utf8');
      if (bytes > MAX_REQUEST_BODY_BYTES) {
        rejected = true;
        reject(new RequestBodyTooLargeError());
        request.resume();
        return;
      }
      body += chunk;
    });
    request.on('end', () => {
      if (rejected) {
        return;
      }
      resolve(body);
    });
    request.on('error', (error) => {
      if (!rejected) {
        reject(error);
      }
    });
  });
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(body));
}

function serverUrl(server: ReturnType<typeof createServer>, host: string): string {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Procedure server did not expose a TCP address');
  }

  const port = address.port;
  return `http://${host}:${String(port)}`;
}

function procedureEndpoint(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Procedure URL must use http or https');
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error('Procedure URL must not include credentials');
  }
  url.pathname = '/rpc';
  url.search = '';
  url.hash = '';
  return url.toString();
}

function responseErrorMessage(body: unknown, status: number): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'object' &&
    body.error !== null &&
    'message' in body.error &&
    typeof body.error.message === 'string'
  ) {
    return body.error.message;
  }
  return `Procedure call failed with status ${String(status)}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class RequestBodyTooLargeError extends Error {
  constructor() {
    super('Procedure request body is too large');
  }
}
