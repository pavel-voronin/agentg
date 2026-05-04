import {
  capabilityCallInputSchema,
  serializeCapabilityRegistration,
  type CapabilityCallInput,
  type CapabilityListOutput,
  type CapabilityRegistration,
  type CapabilityRegistry
} from '@agentg/shared/rpc/capabilities';
import { isProcedureErrorEnvelope, ProcedureDomainError } from '@agentg/shared/rpc/envelope';
import { createTRPCUntypedClient, httpBatchLink } from '@trpc/client';

export const DEFAULT_GATEWAY_CAPABILITY_CALL_TIMEOUT_MS = 15_000;

export type GatewayCapabilityCaller = (
  capability: CapabilityRegistration,
  input: unknown,
  signal: AbortSignal
) => Promise<unknown>;

export type GatewayCapabilityRuntime = {
  capabilityCallTimeoutMs: number;
  capabilityCaller: GatewayCapabilityCaller;
  capabilityRegistry: CapabilityRegistry;
};

export function listGatewayCapabilities(registry: CapabilityRegistry): CapabilityListOutput {
  return {
    capabilities: registry.listAll().map(serializeCapabilityRegistration)
  };
}

export async function callGatewayCapability(
  runtime: GatewayCapabilityRuntime,
  params: unknown
): Promise<unknown> {
  const input = capabilityCallInputSchema.parse(params) satisfies CapabilityCallInput;
  const capability = runtime.capabilityRegistry.get(input.name);
  if (capability === undefined) {
    throw new Error(`Unknown capability: ${input.name}`);
  }

  return withTimeout(
    (signal) => runtime.capabilityCaller(capability, input.input, signal),
    runtime.capabilityCallTimeoutMs,
    capability.name
  );
}

export function createTrpcGatewayCapabilityCaller(): GatewayCapabilityCaller {
  return async (capability, input, signal) => {
    const client = createTRPCUntypedClient({
      links: [
        httpBatchLink({
          url: capability.serviceUrl
        })
      ]
    });
    const response =
      capability.rpcType === 'mutation'
        ? await client.mutation(capability.rpcMethod, input, { signal })
        : await client.query(capability.rpcMethod, input, { signal });

    return unwrapCapabilityResponse(response);
  };
}

function unwrapCapabilityResponse(response: unknown): unknown {
  if (isProcedureErrorEnvelope(response)) {
    throw new ProcedureDomainError(response.error);
  }

  return response;
}

async function withTimeout<T>(
  call: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  capability: string
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Capability timed out after ${String(timeoutMs)}ms: ${capability}`));
  }, timeoutMs);
  timeout.unref();

  try {
    return await call(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}
