const RPC_CALL_EVENT_LIFECYCLES = [
  { label: 'S', suffix: 'started', title: 'Started' },
  { label: 'C', suffix: 'completed', title: 'Completed' },
  { label: 'F', suffix: 'failed', title: 'Failed' },
  { label: 'P', suffix: 'progress', title: 'Progress' }
] as const;

type RpcCallEventSuffix = (typeof RPC_CALL_EVENT_LIFECYCLES)[number]['suffix'];

export const DEFAULT_EVENT_LIMIT = 200;
export const DEFAULT_EVENT_YAML_LIST_LIMIT = 12;
export const MIN_EVENT_LIMIT = 1;
export const MIN_EVENT_YAML_LIST_LIMIT = 1;

export type EventGroup = {
  color: string;
  id: string;
  label: string;
};

export type ControlPlaneEvent = {
  data?: unknown;
  id?: string;
  occurredAt?: string;
  type?: string;
};

export type ControlPlaneStreamEvent = ControlPlaneEvent & {
  yamlListItemLimit: number;
};

export type StatusBadgeKind = 'bad' | 'ok' | 'warn';

export type AppEventBodyView = {
  raw: string;
  yamlLines: AppEventYamlLine[];
};

export type AppEventYamlLine = AppEventYamlContentLine | AppEventYamlRevealLine;

export type AppEventYamlContentLine = {
  kind: 'content';
  indent: number;
  tokens: AppEventYamlToken[];
};

export type AppEventYamlRevealLine = {
  kind: 'reveal';
  depth: number;
  hiddenCount: number;
  id: string;
  indent: number;
  listItemLimit: number;
  path: string;
  startIndex: number;
  values: unknown[];
};

export type AppEventYamlToken =
  | {
      kind: 'modelRef';
      color: string;
      id: string;
      model: string;
    }
  | {
      kind: 'text';
      text: string;
    };

export type AppStandardEventItem = {
  body: AppEventBodyView;
  color: string;
  kind: 'event';
  key: string;
  occurredAt: string;
  type: string;
};

export type AppRpcLifecycleItem = {
  body: AppEventBodyView;
  key: string;
  label: string;
  occurredAt: string;
  occurredAtMs: number | null;
  suffix: string;
  title: string;
  type: string;
};

export type AppRpcEventItem = {
  callId: string;
  color: string;
  kind: 'rpc';
  key: string;
  lifecycles: AppRpcLifecycleItem[];
  target: string;
};

export type AppEventItem = AppStandardEventItem | AppRpcEventItem;

export function rpcCallEventType(target: string, suffix: RpcCallEventSuffix): string {
  const [domain, ...procedureSegments] = target.split('.');
  const procedure = procedureSegments.join('.');
  if (domain === undefined || domain.length === 0 || procedure.length === 0) {
    throw new Error(`Invalid RPC call target: ${target}`);
  }
  return `${domain}.rpc.${procedure}.${suffix}`;
}

export function rpcCallEventTypesForProcedure(target: string): string[] {
  return RPC_CALL_EVENT_LIFECYCLES.map((lifecycle) => rpcCallEventType(target, lifecycle.suffix));
}

export function rpcCallEventTarget(type: string): string | null {
  const suffix = RPC_CALL_EVENT_LIFECYCLES.find((lifecycle) =>
    type.endsWith(`.${lifecycle.suffix}`)
  )?.suffix;
  if (suffix === undefined) {
    return null;
  }

  const eventName = type.slice(0, -(suffix.length + 1));
  const [domain, category, ...procedureSegments] = eventName.split('.');
  const procedure = procedureSegments.join('.');
  if (domain === undefined || domain.length === 0 || category !== 'rpc' || procedure.length === 0) {
    return null;
  }

  return `${domain}.${procedure}`;
}

export type EventsPanelMode = 'events' | 'settings';

export { RPC_CALL_EVENT_LIFECYCLES };

export function rpcCallLifecycleEventType(target: string, suffix: RpcCallEventSuffix): string {
  return rpcCallEventType(target, suffix);
}
