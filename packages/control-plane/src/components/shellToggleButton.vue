<script setup lang="ts">
import { computed } from 'vue';
import SolarBillListBold from '~icons/solar/bill-list-bold';
import SolarEyeBold from '~icons/solar/eye-bold';
import SolarWidget2Bold from '~icons/solar/widget-2-bold';

import { UiButton } from '@agentg/framework/cp';

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
      <SolarWidget2Bold
        v-if="icon === 'dashboard'"
        class="shell-toggle-button__action-icon"
        :data-active="active ? 'true' : undefined"
        aria-hidden="true"
      />
      <SolarBillListBold
        v-else
        class="shell-toggle-button__action-icon"
        :data-active="active ? 'true' : undefined"
        aria-hidden="true"
      />
      <SolarEyeBold
        class="shell-toggle-button__preview-icon"
        :data-active="active ? 'true' : undefined"
        aria-hidden="true"
      />
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
