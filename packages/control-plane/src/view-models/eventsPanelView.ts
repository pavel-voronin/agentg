import {
  enabledEventFiltersCountInState,
  eventGroupFilterStateInState,
  eventGroupForEvent,
  eventTypesForGroupInState,
  filterableEventGroups,
  isEventTypeEnabledInState
} from '../domain/events.js';
import {
  RPC_CALL_EVENT_LIFECYCLES,
  type AppEventBodyView,
  type AppEventYamlLine,
  type AppEventYamlToken,
  type AppEventItem,
  type AppRpcEventItem,
  type AppRpcLifecycleItem,
  type AppStandardEventItem,
  type ControlPlaneEvent,
  type EventFilterDomainView,
  type EventFilterGroupView,
  type EventFilterTypeView,
  type EventFiltersPanelView,
  type EventFiltersState,
  type EventGroup
} from '../stores/controlPlaneTypes.js';
import { formatEventTime, formatOptionalValue } from './formatters.js';

export type EventsPanelViewSource = {
  eventFilters: EventFiltersState;
  events: ControlPlaneEvent[];
};

export type EventTypeMutedLookup = (type: string) => boolean;

type EventFilterDomainId = 'telegram' | 'tdlib' | 'history' | 'summaries';

type EventFilterDomainDefinition = {
  id: EventFilterDomainId;
  label: string;
};

const EVENT_FILTER_DOMAINS: EventFilterDomainDefinition[] = [
  { id: 'telegram', label: 'Telegram' },
  { id: 'tdlib', label: 'Tdlib' },
  { id: 'history', label: 'History' },
  { id: 'summaries', label: 'Summaries' }
];

const EVENT_GROUP_DOMAIN_IDS: Record<string, EventFilterDomainId> = {
  history: 'history',
  summaries: 'summaries',
  telegram_chats: 'telegram',
  telegram_messages: 'telegram',
  telegram_operations: 'telegram',
  telegram_status: 'telegram',
  telegram_tdlib: 'tdlib'
};

export function eventListItem(
  event: ControlPlaneEvent,
  index: number,
  muted: boolean
): AppStandardEventItem {
  const group = eventGroupForEvent(event);
  const type = event.type ?? '';
  return {
    body: eventBodyView(event.data ?? {}),
    color: group.color,
    filterable: group.filterable !== false,
    kind: 'event',
    key: event.id ?? `${formatOptionalValue(event.occurredAt)}:${type}:${String(index)}`,
    muted,
    occurredAt: formatEventTime(event.occurredAt),
    type
  };
}

export function eventListItems(
  events: ControlPlaneEvent[],
  isEventTypeMuted: EventTypeMutedLookup
): AppEventItem[] {
  const items: AppEventItem[] = [];
  const rpcItems = new Map<string, AppRpcEventItem>();

  events.forEach((event, index) => {
    const type = event.type ?? '';
    const group = eventGroupForEvent(event);
    const rpcLifecycle = group.id === 'rpc' ? rpcCallLifecycle(event, type) : null;
    if (rpcLifecycle === null) {
      items.push(eventListItem(event, index, isEventTypeMuted(type)));
      return;
    }

    const itemKey = rpcEventItemKey(rpcLifecycle.target, rpcLifecycle.callId);
    let item = rpcItems.get(itemKey);
    if (item === undefined) {
      item = {
        callId: rpcLifecycle.callId,
        color: group.color,
        filterable: group.filterable !== false,
        kind: 'rpc',
        key: itemKey,
        lifecycleTypes: [],
        lifecycles: [],
        muted: false,
        target: rpcLifecycle.target
      };
      rpcItems.set(itemKey, item);
      items.push(item);
    }

    item.lifecycles.unshift(rpcLifecycleItem(event, index, rpcLifecycle, isEventTypeMuted(type)));
  });

  for (const item of rpcItems.values()) {
    item.lifecycleTypes = [...new Set(item.lifecycles.map((lifecycle) => lifecycle.type))];
    item.lifecycles = item.lifecycles.map((lifecycle, index, lifecycles) => ({
      ...lifecycle,
      occurredAt: rpcLifecycleTimeLabel(lifecycle, lifecycles[index - 1] ?? null)
    }));
    item.muted =
      item.lifecycleTypes.length > 0 && item.lifecycleTypes.every((type) => isEventTypeMuted(type));
  }

  return items;
}

export function eventFiltersPanelView(source: EventsPanelViewSource): EventFiltersPanelView {
  const groups = filterableEventGroups().map((group) => eventFilterGroupView(source, group));
  return {
    domains: eventFilterDomains(groups),
    enabledCount: String(enabledEventFiltersCountInState(source)),
    groups
  };
}

function eventFilterDomains(groups: EventFilterGroupView[]): EventFilterDomainView[] {
  const rpcGroup = groups.find((group) => group.kind === 'rpc');
  return EVENT_FILTER_DOMAINS.map((domain) => {
    const events = groups.flatMap((group) =>
      group.kind === 'types' && EVENT_GROUP_DOMAIN_IDS[group.id] === domain.id ? group.types : []
    );
    const rpc = rpcGroup === undefined ? [] : [eventFilterDomainRpcGroupView(rpcGroup, domain.id)];
    const visibleRpc = rpc.filter((group) => group.rpcCalls.length > 0);
    const enabledEventCount = events.filter((type) => type.enabled).length;
    return {
      enabledCount: String(eventFilterDomainEnabledCount(events, visibleRpc)),
      events,
      eventsChecked: events.length > 0 && enabledEventCount === events.length,
      eventsIndeterminate: enabledEventCount > 0 && enabledEventCount < events.length,
      eventTypes: events.map((event) => event.type),
      id: domain.id,
      label: domain.label,
      rpc: visibleRpc
    };
  }).filter((domain) => domain.events.length > 0 || domain.rpc.length > 0);
}

function eventFilterDomainEnabledCount(
  events: EventFilterTypeView[],
  rpc: EventFilterGroupView[]
): number {
  return (
    events.filter((type) => type.enabled).length +
    rpc.reduce(
      (count, group) =>
        count +
        group.rpcCalls.reduce(
          (callCount, call) =>
            callCount + call.lifecycles.filter((lifecycle) => lifecycle.enabled).length,
          0
        ),
      0
    )
  );
}

function eventFilterDomainRpcGroupView(
  group: EventFilterGroupView,
  domainId: EventFilterDomainId
): EventFilterGroupView {
  const rpcCalls = group.rpcCalls.filter((call) => rpcTargetDomainId(call.target) === domainId);
  const enabledCount = rpcCalls.reduce(
    (count, call) => count + call.lifecycles.filter((lifecycle) => lifecycle.enabled).length,
    0
  );
  const lifecycleCount = rpcCalls.reduce((count, call) => count + call.lifecycles.length, 0);
  return {
    ...group,
    checked: lifecycleCount > 0 && enabledCount === lifecycleCount,
    indeterminate: enabledCount > 0 && enabledCount < lifecycleCount,
    lifecycleColumns: RPC_CALL_EVENT_LIFECYCLES.map((lifecycle) => {
      const columnTypes = rpcCalls.flatMap((call) =>
        call.lifecycles.filter((item) => item.suffix === lifecycle.suffix)
      );
      const columnEnabledCount = columnTypes.filter((item) => item.enabled).length;
      return {
        ...lifecycle,
        checked: columnTypes.length > 0 && columnEnabledCount === columnTypes.length,
        indeterminate: columnEnabledCount > 0 && columnEnabledCount < columnTypes.length,
        types: columnTypes.map((item) => item.type)
      };
    }),
    rpcCalls
  };
}

function eventFilterGroupView(
  source: EventsPanelViewSource,
  group: EventGroup
): EventFilterGroupView {
  const filterState = eventGroupFilterStateInState(source, group);
  if (group.id === 'rpc') {
    return eventFilterRpcGroupView(source, group, filterState);
  }
  return {
    checked: filterState.checked,
    color: group.color,
    id: group.id,
    indeterminate: filterState.indeterminate,
    kind: 'types',
    label: group.label,
    lifecycleColumns: [],
    rpcCalls: [],
    types: eventTypesForGroupInState(source, group).map((type) => ({
      enabled: isEventTypeEnabledInState(source, group, type),
      groupId: group.id,
      type
    }))
  };
}

function eventFilterRpcGroupView(
  source: EventsPanelViewSource,
  group: EventGroup,
  filterState: { checked: boolean; indeterminate: boolean }
): EventFilterGroupView {
  const targets = rpcCallTargetsForGroup(source, group);
  const rpcCalls = targets.map((target) => {
    const lifecycles = RPC_CALL_EVENT_LIFECYCLES.map((lifecycle) => {
      const type = `${target}.${lifecycle.suffix}`;
      return {
        ...lifecycle,
        enabled: isEventTypeEnabledInState(source, group, type),
        type
      };
    });
    const enabledCount = lifecycles.filter((lifecycle) => lifecycle.enabled).length;
    return {
      checked: enabledCount === lifecycles.length,
      indeterminate: enabledCount > 0 && enabledCount < lifecycles.length,
      lifecycles,
      lifecycleTypes: lifecycles.map((lifecycle) => lifecycle.type),
      target
    };
  });
  return {
    checked: filterState.checked,
    color: group.color,
    id: group.id,
    indeterminate: filterState.indeterminate,
    kind: 'rpc',
    label: group.label,
    lifecycleColumns: RPC_CALL_EVENT_LIFECYCLES.map((lifecycle) => {
      const columnTypes = rpcCalls.flatMap((call) =>
        call.lifecycles.filter((item) => item.suffix === lifecycle.suffix)
      );
      const enabledCount = columnTypes.filter((item) => item.enabled).length;
      return {
        ...lifecycle,
        checked: columnTypes.length > 0 && enabledCount === columnTypes.length,
        indeterminate: enabledCount > 0 && enabledCount < columnTypes.length,
        types: columnTypes.map((item) => item.type)
      };
    }),
    rpcCalls,
    types: []
  };
}

function rpcCallTargetsForGroup(source: EventsPanelViewSource, group: EventGroup): string[] {
  return [
    ...new Set(
      eventTypesForGroupInState(source, group)
        .map((type) => rpcCallTarget(type))
        .filter((target): target is string => target !== null)
    )
  ];
}

function rpcCallTarget(type: string): string | null {
  const lifecycle = RPC_CALL_EVENT_LIFECYCLES.find(({ suffix }) => type.endsWith(`.${suffix}`));
  if (lifecycle === undefined) {
    return null;
  }
  return type.slice(0, -(lifecycle.suffix.length + 1));
}

function rpcCallLifecycle(
  event: ControlPlaneEvent,
  type: string
): {
  callId: string;
  lifecycle: (typeof RPC_CALL_EVENT_LIFECYCLES)[number];
  target: string;
} | null {
  const lifecycle = RPC_CALL_EVENT_LIFECYCLES.find(({ suffix }) => type.endsWith(`.${suffix}`));
  const callId = rpcCallId(event.data);
  if (lifecycle === undefined) {
    return null;
  }
  if (callId === null) {
    return null;
  }
  return {
    callId,
    lifecycle,
    target: type.slice(0, -(lifecycle.suffix.length + 1))
  };
}

function rpcLifecycleItem(
  event: ControlPlaneEvent,
  index: number,
  rpcLifecycle: {
    callId: string;
    lifecycle: (typeof RPC_CALL_EVENT_LIFECYCLES)[number];
    target: string;
  },
  muted: boolean
): AppRpcLifecycleItem {
  const type = event.type ?? '';
  return {
    body: eventBodyView(event.data ?? {}),
    key:
      event.id ??
      `${rpcEventItemKey(rpcLifecycle.target, rpcLifecycle.callId)}:${type}:${formatOptionalValue(event.occurredAt)}:${String(index)}`,
    label: rpcLifecycle.lifecycle.label,
    muted,
    occurredAt: '',
    occurredAtMs: eventTimeMs(event.occurredAt),
    suffix: rpcLifecycle.lifecycle.suffix,
    title: rpcLifecycle.lifecycle.title,
    type
  };
}

function rpcLifecycleTimeLabel(
  lifecycle: AppRpcLifecycleItem,
  previous: AppRpcLifecycleItem | null
): string {
  if (previous === null) {
    return formatFullEventTimestamp(lifecycle.occurredAtMs);
  }
  if (lifecycle.occurredAtMs === null || previous.occurredAtMs === null) {
    return '';
  }
  return `+${String(Math.max(0, lifecycle.occurredAtMs - previous.occurredAtMs))} ms`;
}

function eventTimeMs(value: Date | string | undefined): number | null {
  const date = value instanceof Date ? value : new Date(value ?? '');
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatFullEventTimestamp(timestamp: number | null): string {
  return timestamp === null ? '' : new Date(timestamp).toISOString().replace('T', ' ').slice(0, 23);
}

function eventBodyView(value: unknown): AppEventBodyView {
  const yamlLines = yamlValueLines(value, 0);
  return {
    raw: JSON.stringify(value),
    yaml: yamlLineText(yamlLines),
    yamlLines
  };
}

function yamlValueLines(value: unknown, depth: number): AppEventYamlLine[] {
  if (isPlainObject(value)) {
    const modelRef = modelRefParts(value);
    if (modelRef !== null) {
      return [
        { indent: depth, tokens: [modelRef.token] },
        ...modelRef.entries.flatMap(([key, item]) => yamlObjectEntryLines(key, item, depth))
      ];
    }
    const entries = Object.entries(value);
    return entries.length === 0
      ? [{ indent: depth, tokens: [{ kind: 'text', text: '{}' }] }]
      : entries.flatMap(([key, item]) => yamlObjectEntryLines(key, item, depth));
  }
  if (Array.isArray(value)) {
    return value.length === 0
      ? [{ indent: depth, tokens: [{ kind: 'text', text: '[]' }] }]
      : yamlArrayLines(value, depth);
  }
  return [{ indent: depth, tokens: [{ kind: 'text', text: yamlScalar(value) }] }];
}

function yamlObjectEntryLines(key: string, value: unknown, depth: number): AppEventYamlLine[] {
  if (isPlainObject(value)) {
    const modelRef = modelRefParts(value);
    if (modelRef !== null) {
      return [
        { indent: depth, tokens: [{ kind: 'text', text: `${key}: ` }, modelRef.token] },
        ...modelRef.entries.flatMap(([childKey, childValue]) =>
          yamlObjectEntryLines(childKey, childValue, depth + 1)
        )
      ];
    }
    const entries = Object.entries(value);
    return entries.length === 0
      ? [{ indent: depth, tokens: [{ kind: 'text', text: `${key}: {}` }] }]
      : [
          { indent: depth, tokens: [{ kind: 'text', text: `${key}:` }] },
          ...entries.flatMap(([childKey, childValue]) =>
            yamlObjectEntryLines(childKey, childValue, depth + 1)
          )
        ];
  }
  if (Array.isArray(value)) {
    return value.length === 0
      ? [{ indent: depth, tokens: [{ kind: 'text', text: `${key}: []` }] }]
      : [
          { indent: depth, tokens: [{ kind: 'text', text: `${key}:` }] },
          ...yamlArrayLines(value, depth + 1)
        ];
  }
  return [{ indent: depth, tokens: [{ kind: 'text', text: `${key}: ${yamlScalar(value)}` }] }];
}

function yamlArrayLines(values: unknown[], depth: number): AppEventYamlLine[] {
  return values.flatMap((value) => yamlArrayItemLines(value, depth));
}

function yamlArrayItemLines(value: unknown, depth: number): AppEventYamlLine[] {
  if (isPlainObject(value)) {
    const modelRef = modelRefParts(value);
    if (modelRef !== null) {
      return [
        { indent: depth, tokens: [{ kind: 'text', text: '- ' }, modelRef.token] },
        ...modelRef.entries.flatMap(([key, item]) => yamlObjectEntryLines(key, item, depth + 1))
      ];
    }
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return [{ indent: depth, tokens: [{ kind: 'text', text: '- {}' }] }];
    }
    const firstEntry = entries[0];
    if (firstEntry === undefined) {
      return [{ indent: depth, tokens: [{ kind: 'text', text: '- {}' }] }];
    }
    const restEntries = entries.slice(1);
    const [firstKey, firstValue] = firstEntry;
    const [firstLine, ...firstNestedLines] = yamlObjectEntryLines(firstKey, firstValue, 0);
    if (firstLine === undefined) {
      return [{ indent: depth, tokens: [{ kind: 'text', text: '- {}' }] }];
    }
    return [
      {
        indent: depth,
        tokens: [{ kind: 'text', text: '- ' }, ...firstLine.tokens]
      },
      ...firstNestedLines.map((line) => ({ ...line, indent: line.indent + depth + 1 })),
      ...restEntries.flatMap(([key, item]) => yamlObjectEntryLines(key, item, depth + 1))
    ];
  }
  if (Array.isArray(value)) {
    return value.length === 0
      ? [{ indent: depth, tokens: [{ kind: 'text', text: '- []' }] }]
      : [
          { indent: depth, tokens: [{ kind: 'text', text: '-' }] },
          ...yamlArrayLines(value, depth + 1)
        ];
  }
  return [{ indent: depth, tokens: [{ kind: 'text', text: `- ${yamlScalar(value)}` }] }];
}

function yamlScalar(value: unknown): string {
  if (typeof value === 'string') {
    return yamlStringScalar(value);
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : JSON.stringify(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'null';
  }
  return JSON.stringify(value);
}

function yamlStringScalar(value: string): string {
  if (value.length === 0) {
    return '""';
  }
  return /^[A-Za-z0-9._/@:-]+$/.test(value) ? value : JSON.stringify(value);
}

function yamlLineText(lines: AppEventYamlLine[]): string {
  return lines
    .map(
      (line) =>
        `${'  '.repeat(line.indent)}${line.tokens.map((token) => yamlTokenText(token)).join('')}`
    )
    .join('\n');
}

function yamlTokenText(token: AppEventYamlToken): string {
  return token.kind === 'text' ? token.text : `${token.model} ${token.id}`;
}

function modelRefParts(
  value: Record<string, unknown>
): { entries: [string, unknown][]; token: AppEventYamlToken } | null {
  const model = value._model;
  const id = value.id;
  if (typeof model !== 'string' || model.trim().length === 0) {
    return null;
  }
  if (typeof id !== 'string' || id.trim().length === 0) {
    return null;
  }
  return {
    entries: Object.entries(value).filter(([key]) => key !== '_model' && key !== 'id'),
    token: {
      color: modelColor(model),
      id,
      kind: 'modelRef',
      model
    }
  };
}

function modelColor(model: string): string {
  const palette = [
    '#2563eb',
    '#059669',
    '#7c3aed',
    '#dc2626',
    '#0891b2',
    '#c2410c',
    '#4f46e5',
    '#be123c'
  ] as const;
  let hash = 0;
  for (const char of model) {
    hash += char.charCodeAt(0);
  }
  return palette[hash % palette.length] ?? '#2563eb';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rpcEventItemKey(target: string, callId: string): string {
  return `rpc:${target}:${callId}`;
}

function rpcCallId(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null;
  }
  const callId = (data as { callId?: unknown }).callId;
  return typeof callId === 'string' && callId.length > 0 ? callId : null;
}

function rpcTargetDomainId(target: string): EventFilterDomainId | null {
  if (target.startsWith('telegram.tdlib.')) {
    return 'tdlib';
  }
  if (target.startsWith('telegram.')) {
    return 'telegram';
  }
  if (target.startsWith('history.')) {
    return 'history';
  }
  if (target.startsWith('summaries.')) {
    return 'summaries';
  }
  return null;
}
