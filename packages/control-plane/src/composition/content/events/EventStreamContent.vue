<script setup lang="ts">
import { computed } from 'vue';

import type { SlotContext } from '@agentg/control-plane-sdk/slots';
import EventsPanel from '../../../components/EventsPanel.vue';
import { useEventsStore } from '../../../stores/events.js';
import { eventFiltersPanelView, eventListItems } from '../../../view-models/eventsPanelView.js';

const props = defineProps<{
  slotContext?: SlotContext | undefined;
}>();

const eventsStore = useEventsStore();
const eventFiltersPanel = computed(() => eventFiltersPanelView(eventsStore));
const eventItems = computed(() =>
  eventListItems(eventsStore.events, (type) => eventsStore.isEventTypeMuted(type))
);
const eventLimit = computed(() => eventsStore.eventLimit);
const eventsPanelMode = computed(() => eventsStore.eventsPanelMode);
const eventsPaused = computed(() => eventsStore.eventsPaused);
const hasEvents = computed(() => eventsStore.events.length > 0);
const idPrefix = computed(() => contextString(props.slotContext, 'idPrefix', 'events'));

function clearEvents(): void {
  eventsStore.clearEvents();
}

function toggleEventFilters(): void {
  eventsStore.toggleEventsPanelMode('filters');
}

function toggleEventSettings(): void {
  eventsStore.toggleEventsPanelMode('settings');
}

function toggleEventStream(): void {
  eventsStore.toggleEventsPaused();
}

function closeEventFilters(): void {
  eventsStore.setEventsPanelMode('events');
}

function closeEventSettings(): void {
  eventsStore.setEventsPanelMode('events');
}

function setEventLimit(value: number): void {
  eventsStore.setEventLimit(value);
}

function setEventTypeEnabled(type: string, enabled: boolean): void {
  eventsStore.setEventTypeEnabled(type, enabled);
}

function setEventTypeMuted(type: string, muted: boolean): void {
  eventsStore.setEventTypeMuted(type, muted);
}

function clearEventsOfType(type: string): void {
  eventsStore.clearEventsOfType(type);
}

function contextString(context: SlotContext | undefined, key: string, fallback: string): string {
  const value = context?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}
</script>

<template>
  <EventsPanel
    class="event-stream-content"
    :clear-button-id="`${idPrefix}ClearEvents`"
    :event-filters-id="`${idPrefix}EventFilters`"
    :event-list-id="`${idPrefix}Events`"
    :event-limit="eventLimit"
    :event-settings-id="`${idPrefix}EventSettings`"
    :filters-toggle-id="`${idPrefix}EventFiltersToggle`"
    :events="eventItems"
    :has-events="hasEvents"
    :mode="eventsPanelMode"
    :panel-id="`${idPrefix}Panel`"
    :settings-toggle-id="`${idPrefix}EventSettingsToggle`"
    :stream-paused="eventsPaused"
    :stream-toggle-id="`${idPrefix}EventStreamToggle`"
    :view="eventFiltersPanel"
    @clear="clearEvents"
    @clear-type="clearEventsOfType"
    @close-filters="closeEventFilters"
    @close-settings="closeEventSettings"
    @event-limit-change="setEventLimit"
    @filters-toggle="toggleEventFilters"
    @mute-change="setEventTypeMuted"
    @settings-toggle="toggleEventSettings"
    @stream-toggle="toggleEventStream"
    @type-change="setEventTypeEnabled"
  />
</template>

<style scoped>
@reference "tailwindcss";
.event-stream-content {
  @apply h-full;
}
</style>
