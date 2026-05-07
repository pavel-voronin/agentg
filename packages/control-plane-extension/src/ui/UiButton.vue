<script setup lang="ts">
import { computed } from 'vue';

type UiButtonSize = 'icon-md' | 'icon-sm' | 'md' | 'sm' | 'xs';
type UiButtonType = 'button' | 'reset' | 'submit';
type UiButtonVariant = 'danger' | 'neutral' | 'primary' | 'selected';

const props = withDefaults(
  defineProps<{
    size?: UiButtonSize;
    type?: UiButtonType;
    variant?: UiButtonVariant;
  }>(),
  {
    size: 'md',
    type: 'button',
    variant: 'neutral'
  }
);

const buttonClass = computed(() => [
  'inline-flex items-center rounded-lg border font-medium shadow-sm transition active:shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
  sizeClass.value,
  variantClass.value
]);

const sizeClass = computed(() => {
  switch (props.size) {
    case 'icon-md':
      return 'h-8 w-8 justify-center text-sm leading-5';
    case 'icon-sm':
      return 'h-5 w-5 justify-center text-xs leading-5';
    case 'sm':
      return 'h-7 px-2.5 text-xs leading-5';
    case 'xs':
      return 'h-6 px-2 text-xs leading-5';
    case 'md':
      return 'h-8 px-3 text-sm leading-5';
  }
});

const variantClass = computed(() => {
  switch (props.variant) {
    case 'danger':
      return 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:shadow-md';
    case 'primary':
      return 'border-[#111827] bg-[#111827] text-white hover:bg-black hover:shadow-md';
    case 'selected':
      return 'border-[#111827] bg-[#111827] text-white hover:bg-black hover:shadow-md';
    case 'neutral':
      return 'border-[#D1D5DB] bg-white text-[#111827] hover:shadow-md';
  }
});
</script>

<template>
  <button :type="type" :class="buttonClass">
    <slot />
  </button>
</template>
