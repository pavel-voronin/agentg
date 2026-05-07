export const RPC_CALL_STARTED_EVENT_SUFFIX = 'started';
export const RPC_CALL_PROGRESS_EVENT_SUFFIX = 'progress';
export const RPC_CALL_COMPLETED_EVENT_SUFFIX = 'completed';
export const RPC_CALL_FAILED_EVENT_SUFFIX = 'failed';
export const RPC_CALL_EVENT_PREFIX = 'rpc';

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

export function rpcCallEventType(target: string, suffix: RpcCallEventSuffix): string {
  return `${RPC_CALL_EVENT_PREFIX}.${target}.${suffix}`;
}

export function rpcCallEventTarget(type: string): string | null {
  if (!type.startsWith(`${RPC_CALL_EVENT_PREFIX}.`)) {
    return null;
  }

  const lifecycle = RPC_CALL_EVENT_LIFECYCLES.find(({ suffix }) => type.endsWith(`.${suffix}`));
  if (lifecycle === undefined) {
    return null;
  }

  const target = type.slice(RPC_CALL_EVENT_PREFIX.length + 1, -(lifecycle.suffix.length + 1));
  return target.length > 0 ? target : null;
}
