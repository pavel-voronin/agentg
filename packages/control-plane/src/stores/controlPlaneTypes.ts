import {
  RPC_CALL_EVENT_LIFECYCLES,
  rpcCallEventTarget,
  rpcCallEventTypesForProcedure,
  rpcCallEventType
} from '@agentg/rpc/call-event-types';
import type { RpcCallEventSuffix } from '@agentg/rpc/call-event-types';

export const DEFAULT_EVENT_LIMIT = 200;
export const DEFAULT_EVENT_YAML_LIST_LIMIT = 12;
export const MIN_EVENT_LIMIT = 1;
export const MIN_EVENT_YAML_LIST_LIMIT = 1;

export type EventGroup = {
  color: string;
  eventTypes: string[];
  filterable?: boolean;
  id: string;
  label: string;
  match: (type: string) => boolean;
};

export type ControlPlaneEvent = {
  data?: unknown;
  id?: string;
  occurredAt?: Date | string;
  type?: string;
};

export type ControlPlaneStreamEvent = ControlPlaneEvent & {
  yamlListItemLimit: number;
};

export type StatusBadgeKind = 'bad' | 'ok' | 'warn';

export type StatusBadgeView = {
  kind: StatusBadgeKind;
  label: string;
};

export type AppShellView = {
  controlPlaneStatus: StatusBadgeView;
  dashboardCollapsed: boolean;
  eventsPanelCollapsed: boolean;
  slotDebugEnabled: boolean;
};

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
  filterable: boolean;
  kind: 'event';
  key: string;
  muted: boolean;
  occurredAt: string;
  type: string;
};

export type AppRpcLifecycleItem = {
  body: AppEventBodyView;
  key: string;
  label: string;
  muted: boolean;
  occurredAt: string;
  occurredAtMs: number | null;
  suffix: string;
  title: string;
  type: string;
};

export type AppRpcEventItem = {
  callId: string;
  color: string;
  filterable: boolean;
  kind: 'rpc';
  key: string;
  lifecycleTypes: string[];
  lifecycles: AppRpcLifecycleItem[];
  muted: boolean;
  target: string;
};

export type AppEventItem = AppStandardEventItem | AppRpcEventItem;

export type EventFiltersState = {
  groups: Record<string, boolean>;
  types: Record<string, boolean>;
};

export type EventCatalogProcedure = {
  kind: 'mutation' | 'query';
  name: string;
};

export type EventCatalogService = {
  events: string[];
  procedures: EventCatalogProcedure[];
  slug: string;
};

export type EventCatalogState = {
  services: EventCatalogService[];
  version: number;
};

export type EventFilterTypeView = {
  enabled: boolean;
  groupId: string;
  type: string;
};

export type EventFilterLifecycleColumnView = {
  checked: boolean;
  indeterminate: boolean;
  label: string;
  suffix: string;
  title: string;
  types: string[];
};

export type EventFilterRpcLifecycleView = {
  enabled: boolean;
  label: string;
  suffix: string;
  title: string;
  type: string;
};

export type EventFilterRpcCallView = {
  checked: boolean;
  indeterminate: boolean;
  lifecycles: EventFilterRpcLifecycleView[];
  lifecycleTypes: string[];
  target: string;
};

export type EventFilterGroupView = {
  checked: boolean;
  color: string;
  id: string;
  indeterminate: boolean;
  kind: 'rpc' | 'types';
  label: string;
  lifecycleColumns: EventFilterLifecycleColumnView[];
  rpcCalls: EventFilterRpcCallView[];
  types: EventFilterTypeView[];
};

export type EventFilterDomainView = {
  enabledCount: string;
  events: EventFilterTypeView[];
  eventsChecked: boolean;
  eventsIndeterminate: boolean;
  eventTypes: string[];
  id: string;
  label: string;
  rpc: EventFilterGroupView[];
};

export type EventFiltersPanelView = {
  domains: EventFilterDomainView[];
  enabledCount: string;
  groups: EventFilterGroupView[];
};

export type EventsPanelMode = 'events' | 'filters' | 'settings';

export { RPC_CALL_EVENT_LIFECYCLES, rpcCallEventTarget, rpcCallEventTypesForProcedure };

export function rpcCallLifecycleEventType(target: string, suffix: RpcCallEventSuffix): string {
  return rpcCallEventType(target, suffix);
}
