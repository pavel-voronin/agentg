<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { UiButton } from '@agentg/framework/cp';

const props = defineProps<{
  eventLimit: number;
  eventYamlListLimit: number;
  id: string;
}>();

const emit = defineEmits<{
  close: [];
  eventLimitChange: [value: number];
  eventYamlListLimitChange: [value: number];
}>();

type NumberInputTarget = {
  value: string;
};

const eventLimitInput = ref(String(props.eventLimit));
const eventLimitInputId = computed(() => `${props.id}Limit`);
const eventYamlListLimitInput = ref(String(props.eventYamlListLimit));
const eventYamlListLimitInputId = computed(() => `${props.id}YamlListLimit`);

watch(
  () => props.eventLimit,
  (eventLimit) => {
    eventLimitInput.value = String(eventLimit);
  }
);

watch(
  () => props.eventYamlListLimit,
  (eventYamlListLimit) => {
    eventYamlListLimitInput.value = String(eventYamlListLimit);
  }
);

function onEventLimitInput(event: Event): void {
  const input = numberInputTarget(event);
  if (input === null) {
    return;
  }
  const limit = Number(input.value);
  if (Number.isFinite(limit) && limit > 0) {
    emit('eventLimitChange', limit);
  }
}

function onEventYamlListLimitInput(event: Event): void {
  const input = numberInputTarget(event);
  if (input === null) {
    return;
  }
  const limit = Number(input.value);
  if (Number.isFinite(limit) && limit > 0) {
    emit('eventYamlListLimitChange', limit);
  }
}

function syncEventLimitInput(): void {
  eventLimitInput.value = String(props.eventLimit);
}

function syncEventYamlListLimitInput(): void {
  eventYamlListLimitInput.value = String(props.eventYamlListLimit);
}

function numberInputTarget(event: Event): NumberInputTarget | null {
  return event.target === null ? null : (event.target as unknown as NumberInputTarget);
}
</script>

<template>
  <form :id="id" class="event-settings" @submit.prevent>
    <div class="event-settings__body">
      <section class="event-settings__section">
        <label :for="eventLimitInputId" class="event-settings__label">Event limit</label>
        <input
          :id="eventLimitInputId"
          v-model="eventLimitInput"
          class="event-settings__input"
          inputmode="numeric"
          min="1"
          step="1"
          type="number"
          @blur="syncEventLimitInput"
          @input="onEventLimitInput"
        />
      </section>
      <section class="event-settings__section">
        <label :for="eventYamlListLimitInputId" class="event-settings__label">
          YAML list limit
        </label>
        <input
          :id="eventYamlListLimitInputId"
          v-model="eventYamlListLimitInput"
          class="event-settings__input"
          inputmode="numeric"
          min="1"
          step="1"
          type="number"
          @blur="syncEventYamlListLimitInput"
          @input="onEventYamlListLimitInput"
        />
      </section>
      <UiButton class="event-settings__close-button" variant="primary" @click="emit('close')">
        Close Settings
      </UiButton>
    </div>
  </form>
</template>

<style scoped>
@reference "tailwindcss";
.event-settings {
  @apply min-h-0 flex-1 overflow-auto bg-white;
}

.event-settings__body {
  @apply grid gap-3 p-3;
}

.event-settings__section {
  @apply rounded-lg border border-zinc-200 bg-white p-3;
}

.event-settings__label {
  @apply block text-sm font-semibold;
}

.event-settings__input {
  @apply mt-2 h-9 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1;
}

.event-settings__close-button {
  @apply mt-1 h-9 justify-center;
}
</style>
