<script setup lang="ts">
import { computed } from 'vue';

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

const buttonClass = computed(() =>
  props.active
    ? 'group inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-900 bg-zinc-900 px-2.5 text-xs font-medium text-white shadow-sm hover:bg-zinc-800'
    : 'group inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50'
);

const actionIconClass = computed(() =>
  props.active ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5 group-hover:hidden'
);

const previewIconClass = computed(() =>
  props.active ? 'hidden' : 'absolute hidden h-3.5 w-3.5 group-hover:block'
);

const title = computed(() => (props.active ? props.titleActive : props.titleInactive));

function emitPreviewEnter(): void {
  if (!props.active) {
    emit('previewEnter');
  }
}
</script>

<template>
  <button
    type="button"
    :aria-pressed="active"
    :class="buttonClass"
    :title="title"
    @blur="emit('previewLeave')"
    @click="emit('toggle')"
    @mouseleave="emit('previewLeave')"
  >
    <span
      class="relative inline-flex h-3.5 w-3.5 items-center justify-center"
      @mouseenter="emitPreviewEnter"
      @mouseleave="emit('previewLeave')"
    >
      <svg
        :class="actionIconClass"
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
        :class="previewIconClass"
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
  </button>
</template>
