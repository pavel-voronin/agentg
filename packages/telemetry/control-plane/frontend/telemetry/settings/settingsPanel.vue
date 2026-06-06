<script setup lang="ts">
import type { ReportRequestMode } from '../types.js';

defineProps<{
  loading: boolean;
  maxReportRecordLimit: string;
  recordLimitInput: string;
  requestMode: ReportRequestMode;
  resetConfirmOpen: boolean;
  storageFootprint: string;
}>();

const emit = defineEmits<{
  apply: [];
  cancelReset: [];
  confirmReset: [];
  live: [];
  requestReset: [];
  'update:recordLimitInput': [value: string];
}>();

function updateRecordLimit(event: Event): void {
  const input = event.target as HTMLInputElement;
  emit('update:recordLimitInput', input.value);
}
</script>

<template>
  <section class="telemetry-settings">
    <label class="telemetry-settings__field">
      <span class="telemetry-settings__field-label">Window records</span>
      <input
        class="telemetry-settings__field-input"
        inputmode="numeric"
        min="1"
        :value="recordLimitInput"
        type="number"
        @input="updateRecordLimit"
      />
    </label>
    <div class="telemetry-settings__meta">
      mode {{ requestMode }} / max {{ maxReportRecordLimit }}
    </div>
    <div class="telemetry-settings__actions">
      <button
        type="button"
        class="telemetry-settings__button"
        :disabled="loading"
        @click="emit('apply')"
      >
        Apply
      </button>
      <button
        type="button"
        class="telemetry-settings__button"
        :disabled="loading"
        @click="emit('live')"
      >
        Live
      </button>
      <button
        type="button"
        class="telemetry-settings__button"
        :disabled="loading"
        @click="emit('requestReset')"
      >
        Reset
      </button>
    </div>
    <div v-if="resetConfirmOpen" class="telemetry-settings__reset">
      <div class="telemetry-settings__reset-copy">
        Clear {{ storageFootprint }} of recorded telemetry.
      </div>
      <div class="telemetry-settings__reset-actions">
        <button
          type="button"
          class="telemetry-settings__button"
          data-tone="danger"
          :disabled="loading"
          @click="emit('confirmReset')"
        >
          Reset
        </button>
        <button
          type="button"
          class="telemetry-settings__button"
          :disabled="loading"
          @click="emit('cancelReset')"
        >
          Cancel
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
@reference "tailwindcss";

.telemetry-settings {
  @apply mt-4 grid grid-cols-[minmax(180px,260px)_minmax(0,1fr)_auto] items-end gap-3 rounded border border-zinc-200 bg-zinc-50 p-3;
}

.telemetry-settings__field {
  @apply grid gap-1;
}

.telemetry-settings__field-label {
  @apply text-xs font-medium text-zinc-500;
}

.telemetry-settings__field-input {
  @apply h-9 rounded border border-zinc-300 bg-white px-2 text-sm tabular-nums text-zinc-950 focus:border-zinc-500 focus:outline-none;
}

.telemetry-settings__meta {
  @apply min-w-0 truncate pb-2 text-xs text-zinc-500;
}

.telemetry-settings__actions {
  @apply flex gap-2;
}

.telemetry-settings__button {
  @apply h-9 rounded border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-wait disabled:opacity-60;
}

.telemetry-settings__button[data-tone='danger'] {
  @apply border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:text-red-800;
}

.telemetry-settings__reset {
  @apply col-span-full flex items-center justify-between gap-3 rounded border border-red-200 bg-red-50 p-3;
}

.telemetry-settings__reset-copy {
  @apply min-w-0 text-sm font-medium text-red-800;
}

.telemetry-settings__reset-actions {
  @apply flex shrink-0 gap-2;
}
</style>
