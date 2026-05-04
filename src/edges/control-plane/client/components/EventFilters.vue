<script setup lang="ts">
import type { EventFiltersPanelView } from '../stores/controlPlaneTypes.js';

defineProps<{
  view: EventFiltersPanelView;
}>();

const emit = defineEmits<{
  close: [];
  groupChange: [groupId: string, enabled: boolean];
  limitChange: [value: string];
  typeChange: [type: string, enabled: boolean];
}>();

type InputEventTarget = {
  checked: boolean;
  value: string;
};

function onGroupChange(groupId: string, event: Event): void {
  const input = inputTarget(event);
  if (input !== null) {
    emit('groupChange', groupId, input.checked);
  }
}

function onTypeChange(type: string, event: Event): void {
  const input = inputTarget(event);
  if (input !== null) {
    emit('typeChange', type, input.checked);
  }
}

function onLimitChange(event: Event): void {
  const input = inputTarget(event);
  if (input !== null) {
    emit('limitChange', input.value);
  }
}

function inputTarget(event: Event): InputEventTarget | null {
  return event.target === null ? null : (event.target as unknown as InputEventTarget);
}
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto bg-white">
    <div class="grid gap-3 p-3">
      <section
        v-for="group in view.groups"
        :key="group.id"
        class="rounded-lg border border-zinc-200 bg-white p-3"
      >
        <label class="flex cursor-pointer items-center gap-2">
          <input
            :checked="group.checked"
            :indeterminate.prop="group.indeterminate"
            type="checkbox"
            class="h-4 w-4 rounded border-zinc-300"
            @change="onGroupChange(group.id, $event)"
          />
          <span class="h-3 w-3 rounded-sm" :style="{ background: group.color }"></span>
          <span class="min-w-0 flex-1 text-sm font-semibold">{{ group.label }}</span>
        </label>
        <div class="mt-2 flex flex-wrap gap-1.5 pl-6">
          <label
            v-for="type in group.types"
            :key="type.type"
            class="inline-flex min-w-0 cursor-pointer items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600"
          >
            <input
              :checked="type.enabled"
              type="checkbox"
              class="h-3 w-3 rounded border-zinc-300"
              @change="onTypeChange(type.type, $event)"
            />
            <span class="truncate">{{ type.type }}</span>
          </label>
        </div>
      </section>

      <section class="rounded-lg border border-zinc-200 bg-white p-3">
        <label class="grid gap-2">
          <span class="text-sm font-semibold">Event limit</span>
          <input
            :max="view.maxLimit"
            :min="view.minLimit"
            :step="view.step"
            :value="view.limit"
            type="number"
            class="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            @change="onLimitChange"
          />
        </label>
      </section>

      <button
        type="button"
        class="mt-1 h-9 rounded-lg border border-zinc-800 bg-zinc-800 px-3 text-sm font-medium text-white hover:bg-zinc-950"
        @click="emit('close')"
      >
        Close Filters
      </button>
    </div>
  </div>
</template>
