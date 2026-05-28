import type { EventBus } from '@agentg/events/bus';

export const INTERNAL_RPC_CALL_OPTIONS_HEADER = 'x-agentg-call-options';

export type InternalRpcCallOptions = {
  observable?: boolean;
  silent?: boolean;
};

export type InternalRpcOperationContext = Record<string, unknown>;

export type InternalRpcOperation = {
  context?: InternalRpcOperationContext | undefined;
  path: string;
};

export type InternalRpcProcedureOptions = {
  context?: InternalRpcCallOptions;
  signal?: AbortSignal;
};

type InternalRpcCallOptionsHeaderEntry = InternalRpcCallOptions & {
  path: string;
};

export function internalRpcProcedureOptions(
  callOptions?: InternalRpcCallOptions,
  signal?: AbortSignal
): InternalRpcProcedureOptions {
  const options: InternalRpcProcedureOptions = {};
  if (hasInternalRpcCallOptions(callOptions)) {
    options.context = callOptions;
  }
  if (signal !== undefined) {
    options.signal = signal;
  }

  return options;
}

export function createInternalRpcCallOptionsHeaders(
  operations: readonly InternalRpcOperation[]
): Record<string, string> {
  const entries = operations.flatMap((operation) => {
    const callOptions = internalRpcCallOptionsFromContext(operation.context);
    return hasInternalRpcCallOptions(callOptions)
      ? [
          {
            path: operation.path,
            ...callOptions
          }
        ]
      : [];
  });

  return entries.length === 0
    ? {}
    : {
        [INTERNAL_RPC_CALL_OPTIONS_HEADER]: JSON.stringify(entries)
      };
}

export function createInternalRpcCallOptionsResolver(
  header: string | string[] | undefined
): (path: string) => InternalRpcCallOptions {
  const queues = new Map<string, InternalRpcCallOptions[]>();

  for (const entry of parseCallOptionsHeader(header)) {
    const { path, ...callOptions } = entry;
    const queue = queues.get(path);
    if (queue === undefined) {
      queues.set(path, [callOptions]);
      continue;
    }

    queue.push(callOptions);
  }

  return (path) => {
    const queue = queues.get(path);
    if (queue === undefined || queue.length === 0) {
      return {};
    }

    return queue.shift() ?? {};
  };
}

export function internalRpcCallOptionsFromContext(
  context: InternalRpcOperationContext | undefined
): InternalRpcCallOptions {
  if (context === undefined) {
    return {};
  }

  const callOptions: InternalRpcCallOptions = {};
  if (typeof context.observable === 'boolean') {
    callOptions.observable = context.observable;
  }
  if (typeof context.silent === 'boolean') {
    callOptions.silent = context.silent;
  }

  return callOptions;
}

export function shouldPublishInternalRpcLifecycle(options: InternalRpcCallOptions): boolean {
  return options.silent !== true && options.observable !== false;
}

export function eventBusForInternalRpcCall(
  eventBus: EventBus | undefined,
  options: InternalRpcCallOptions | undefined
): EventBus | undefined {
  if (eventBus === undefined || options?.silent !== true) {
    return eventBus;
  }

  return {
    close() {
      return eventBus.close();
    },
    publish() {
      return;
    },
    subscribe(subject, handler) {
      return eventBus.subscribe(subject, handler);
    }
  };
}

function parseCallOptionsHeader(
  header: string | string[] | undefined
): InternalRpcCallOptionsHeaderEntry[] {
  const text = firstHeaderValue(header);
  if (text === undefined) {
    return [];
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries.flatMap(parseHeaderEntry);
  } catch {
    return [];
  }
}

function parseHeaderEntry(value: unknown): InternalRpcCallOptionsHeaderEntry[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [];
  }

  const record = value as Record<string, unknown>;
  if (typeof record.path !== 'string' || record.path.trim().length === 0) {
    return [];
  }

  const entry: InternalRpcCallOptionsHeaderEntry = {
    path: record.path.trim()
  };
  if (typeof record.observable === 'boolean') {
    entry.observable = record.observable;
  }
  if (typeof record.silent === 'boolean') {
    entry.silent = record.silent;
  }

  return hasInternalRpcCallOptions(entry) ? [entry] : [];
}

function firstHeaderValue(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function hasInternalRpcCallOptions(
  options: InternalRpcCallOptions | undefined
): options is InternalRpcCallOptions {
  return options?.observable !== undefined || options?.silent !== undefined;
}
