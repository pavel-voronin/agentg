import {
  credentials,
  Metadata,
  ServerCredentials,
  type CallOptions,
  type ChannelCredentials
} from '@grpc/grpc-js';

export const DEFAULT_INTERNAL_RPC_TIMEOUT_MS = 5000;
export const CORRELATION_ID_METADATA_KEY = 'x-agentg-correlation-id';

export function createInsecureInternalRpcCredentials(): ChannelCredentials {
  return credentials.createInsecure();
}

export function createInsecureInternalRpcServerCredentials(): ServerCredentials {
  return ServerCredentials.createInsecure();
}

export function createInternalRpcDeadline(
  timeoutMs = DEFAULT_INTERNAL_RPC_TIMEOUT_MS,
  nowMs = Date.now()
): Date {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('RPC timeout must be a positive integer');
  }

  return new Date(nowMs + timeoutMs);
}

export function createInternalRpcCallOptions(
  timeoutMs = DEFAULT_INTERNAL_RPC_TIMEOUT_MS
): CallOptions {
  return {
    deadline: createInternalRpcDeadline(timeoutMs)
  };
}

export function createInternalRpcMetadata(options: { correlationId?: string } = {}): Metadata {
  const metadata = new Metadata();

  if (options.correlationId !== undefined && options.correlationId.length > 0) {
    metadata.set(CORRELATION_ID_METADATA_KEY, options.correlationId);
  }

  return metadata;
}

export function readInternalRpcCorrelationId(metadata: Metadata): string | undefined {
  const [firstValue] = metadata.get(CORRELATION_ID_METADATA_KEY);

  return typeof firstValue === 'string' ? firstValue : undefined;
}
