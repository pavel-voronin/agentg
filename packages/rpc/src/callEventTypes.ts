export const RPC_CALL_STARTED_EVENT_SUFFIX = 'started';
export const RPC_CALL_PROGRESS_EVENT_SUFFIX = 'progress';
export const RPC_CALL_COMPLETED_EVENT_SUFFIX = 'completed';
export const RPC_CALL_FAILED_EVENT_SUFFIX = 'failed';
export const RPC_CALL_EVENT_CATEGORY = 'rpc';

export const RPC_CALL_EVENT_LIFECYCLES = [
  { label: 'S', suffix: RPC_CALL_STARTED_EVENT_SUFFIX, title: 'Started' },
  { label: 'C', suffix: RPC_CALL_COMPLETED_EVENT_SUFFIX, title: 'Completed' },
  { label: 'F', suffix: RPC_CALL_FAILED_EVENT_SUFFIX, title: 'Failed' },
  { label: 'P', suffix: RPC_CALL_PROGRESS_EVENT_SUFFIX, title: 'Progress' }
] as const;

export type RpcCallEventSuffix =
  | typeof RPC_CALL_STARTED_EVENT_SUFFIX
  | typeof RPC_CALL_PROGRESS_EVENT_SUFFIX
  | typeof RPC_CALL_COMPLETED_EVENT_SUFFIX
  | typeof RPC_CALL_FAILED_EVENT_SUFFIX;

export type RpcProcedureManifestEntry = {
  name: string;
};

export type RpcEventManifest = {
  events: readonly string[];
  procedures: readonly RpcProcedureManifestEntry[];
};

export function rpcCallEventType(target: string, suffix: RpcCallEventSuffix): string {
  const [domain, ...procedureSegments] = target.split('.');
  const procedure = procedureSegments.join('.');
  if (domain === undefined || domain.length === 0 || procedure.length === 0) {
    throw new Error(`Invalid RPC call target: ${target}`);
  }
  return `${domain}.${RPC_CALL_EVENT_CATEGORY}.${procedure}.${suffix}`;
}

export function rpcCallEventTypesForProcedure(target: string): string[] {
  return RPC_CALL_EVENT_LIFECYCLES.map(({ suffix }) => rpcCallEventType(target, suffix));
}

export function serviceManifestEventTypes(manifest: RpcEventManifest): string[] {
  return [
    ...manifest.events,
    ...manifest.procedures.flatMap((procedure) => rpcCallEventTypesForProcedure(procedure.name))
  ];
}

export function rpcCallEventTarget(type: string): string | null {
  const lifecycle = RPC_CALL_EVENT_LIFECYCLES.find(({ suffix }) => type.endsWith(`.${suffix}`));
  if (lifecycle === undefined) {
    return null;
  }

  const eventName = type.slice(0, -(lifecycle.suffix.length + 1));
  const [domain, category, ...procedureSegments] = eventName.split('.');
  const procedure = procedureSegments.join('.');
  if (
    domain === undefined ||
    domain.length === 0 ||
    category !== RPC_CALL_EVENT_CATEGORY ||
    procedure.length === 0
  ) {
    return null;
  }

  return `${domain}.${procedure}`;
}
