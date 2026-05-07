<script setup lang="ts">
import { computed } from 'vue';

import UiButton from '@agentg/control-plane-sdk/ui';

const props = defineProps<{
  active: boolean;
  icon: 'dashboard' | 'events';
  label: string;
  titleActive: string;
  titleInactive: string;
}>();

const emit = defineEmits<{
  previewEnter: [];
  previewLeave: [];
  toggle: [];
}>();

const title = computed(() => (props.active ? props.titleActive : props.titleInactive));

function emitPreviewEnter(): void {
  if (!props.active) {
    emit('previewEnter');
  }
}
</script>

<template>
  <UiButton
    :aria-pressed="active"
    class="shell-toggle-button"
    :title="title"
    :variant="active ? 'selected' : 'neutral'"
    @blur="emit('previewLeave')"
    @click="emit('toggle')"
    @mouseleave="emit('previewLeave')"
  >
    <span
      class="shell-toggle-button__icon-frame"
      @mouseenter="emitPreviewEnter"
      @mouseleave="emit('previewLeave')"
    >
      <svg
        class="shell-toggle-button__action-icon"
        :data-active="active ? 'true' : undefined"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <template v-if="icon === 'dashboard'">
          <path d="M3 3h5v5H3z" />
          <path d="M12 3h5v5h-5z" />
          <path d="M3 12h5v5H3z" />
          <path d="M12 12h5v5h-5z" />
        </template>
        <template v-else>
          <path d="M4 5h12" />
          <path d="M4 10h12" />
          <path d="M4 15h8" />
        </template>
      </svg>
      <svg
        class="shell-toggle-button__preview-icon"
        :data-active="active ? 'true' : undefined"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M2.5 10S5.5 5 10 5s7.5 5 7.5 5-3 5-7.5 5-7.5-5-7.5-5Z" />
        <path d="M10 8.25a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5Z" />
      </svg>
    </span>
    <span>{{ label }}</span>
  </UiButton>
</template>

<style scoped>
@reference "tailwindcss";
.shell-toggle-button {
  @apply gap-1.5 px-2.5 text-xs;
}

.shell-toggle-button__icon-frame {
  @apply relative inline-flex h-3.5 w-3.5 items-center justify-center;
}

.shell-toggle-button__action-icon {
  @apply h-3.5 w-3.5;
}

.shell-toggle-button:hover .shell-toggle-button__action-icon {
  @apply hidden;
}

.shell-toggle-button:hover .shell-toggle-button__action-icon[data-active='true'] {
  @apply block;
}

.shell-toggle-button__preview-icon {
  @apply absolute hidden h-3.5 w-3.5;
}

.shell-toggle-button:hover .shell-toggle-button__preview-icon {
  @apply block;
}

.shell-toggle-button:hover .shell-toggle-button__preview-icon[data-active='true'] {
  @apply hidden;
}
</style>
