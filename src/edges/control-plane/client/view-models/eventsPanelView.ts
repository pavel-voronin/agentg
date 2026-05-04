import {
  enabledEventFiltersCountInState,
  eventGroupFilterStateInState,
  eventGroupForEvent,
  eventTypesForGroupInState,
  filterableEventGroups,
  isEventTypeEnabledInState
} from '../domain/events.js';
import {
  EVENT_LIMIT_STEP,
  MAX_EVENT_LIMIT,
  MIN_EVENT_LIMIT,
  type AppEventItem,
  type ControlPlaneEvent,
  type EventFilterGroupView,
  type EventFiltersPanelView,
  type EventFiltersState,
  type EventGroup
} from '../stores/controlPlaneTypes.js';
import { formatEventTime, formatOptionalValue } from './formatters.js';

export type EventsPanelViewSource = {
  eventFilters: EventFiltersState;
  eventLimit: number;
  events: ControlPlaneEvent[];
};

export function eventListItem(event: ControlPlaneEvent, index: number): AppEventItem {
  const group = eventGroupForEvent(event);
  const type = event.type ?? '';
  return {
    color: group.color,
    dataJson: JSON.stringify(event.data ?? {}),
    key: event.id ?? `${formatOptionalValue(event.occurredAt)}:${type}:${String(index)}`,
    occurredAt: formatEventTime(event.occurredAt),
    type
  };
}

export function eventFiltersPanelView(source: EventsPanelViewSource): EventFiltersPanelView {
  return {
    enabledCount: String(enabledEventFiltersCountInState(source)),
    groups: filterableEventGroups().map((group) => eventFilterGroupView(source, group)),
    limit: source.eventLimit,
    maxLimit: MAX_EVENT_LIMIT,
    minLimit: MIN_EVENT_LIMIT,
    step: EVENT_LIMIT_STEP
  };
}

function eventFilterGroupView(
  source: EventsPanelViewSource,
  group: EventGroup
): EventFilterGroupView {
  const filterState = eventGroupFilterStateInState(source, group);
  return {
    checked: filterState.checked,
    color: group.color,
    id: group.id,
    indeterminate: filterState.indeterminate,
    label: group.label,
    types: eventTypesForGroupInState(source, group).map((type) => ({
      enabled: isEventTypeEnabledInState(source, group, type),
      groupId: group.id,
      type
    }))
  };
}
