<script setup lang="ts">
import { computed } from 'vue';

import { UiPage, type SlotContext } from '@agentg/framework/dashboard';
import EventsPanel from '../../../components/eventsPanel.vue';
import { useEventsStore } from '../../../stores/events.js';
import { eventListItems } from '../../../view-models/eventsPanelView.js';

const props = defineProps<{
  slotContext?: SlotContext | undefined;
}>();

const eventsStore = useEventsStore();
const eventItems = computed(() => eventListItems(eventsStore.events));
const eventLimit = computed(() => eventsStore.eventLimit);
const eventYamlListLimit = computed(() => eventsStore.eventYamlListLimit);
const eventsPanelMode = computed(() => eventsStore.eventsPanelMode);
const eventsPaused = computed(() => eventsStore.eventsPaused);
const hasEvents = computed(() => eventsStore.events.length > 0);
const idPrefix = computed(() => contextString(props.slotContext, 'idPrefix', 'events'));

function clearEvents(): void {
  eventsStore.clearEvents();
}

function toggleEventSettings(): void {
  eventsStore.toggleEventsPanelMode('settings');
}

function toggleEventStream(): void {
  eventsStore.toggleEventsPaused();
}

function closeEventSettings(): void {
  eventsStore.setEventsPanelMode('events');
}

function setEventLimit(value: number): void {
  eventsStore.setEventLimit(value);
}

function setEventYamlListLimit(value: number): void {
  eventsStore.setEventYamlListLimit(value);
}

function contextString(context: SlotContext | undefined, key: string, fallback: string): string {
  const value = context?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}
</script>

<template>
  <UiPage padding="none" scroll="hidden">
    <EventsPanel
      :clear-button-id="`${idPrefix}ClearEvents`"
      :event-list-id="`${idPrefix}Events`"
      :event-limit="eventLimit"
      :event-settings-id="`${idPrefix}EventSettings`"
      :event-yaml-list-limit="eventYamlListLimit"
      :events="eventItems"
      :has-events="hasEvents"
      :mode="eventsPanelMode"
      :panel-id="`${idPrefix}Panel`"
      :settings-toggle-id="`${idPrefix}EventSettingsToggle`"
      :stream-paused="eventsPaused"
      :stream-toggle-id="`${idPrefix}EventStreamToggle`"
      @clear="clearEvents"
      @close-settings="closeEventSettings"
      @event-limit-change="setEventLimit"
      @event-yaml-list-limit-change="setEventYamlListLimit"
      @settings-toggle="toggleEventSettings"
      @stream-toggle="toggleEventStream"
    />
  </UiPage>
</template>
