<script setup lang="ts">
type UiButtonSize = 'icon-md' | 'icon-sm' | 'md' | 'sm' | 'xs';
type UiButtonType = 'button' | 'reset' | 'submit';
type UiButtonVariant = 'danger' | 'neutral' | 'primary' | 'selected';

withDefaults(
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
</script>

<template>
  <button :type="type" class="ui-button" :data-size="size" :data-variant="variant">
    <slot />
  </button>
</template>

<style scoped>
@reference "tailwindcss";
.ui-button {
  @apply inline-flex items-center rounded-lg border font-medium shadow-sm transition active:shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50;
}

.ui-button[data-size='icon-md'] {
  @apply h-8 w-8 justify-center text-sm leading-5;
}

.ui-button[data-size='icon-sm'] {
  @apply h-5 w-5 justify-center text-xs leading-5;
}

.ui-button[data-size='md'] {
  @apply h-8 px-3 text-sm leading-5;
}

.ui-button[data-size='sm'] {
  @apply h-7 px-2.5 text-xs leading-5;
}

.ui-button[data-size='xs'] {
  @apply h-6 px-2 text-xs leading-5;
}

.ui-button[data-variant='danger'] {
  @apply border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:shadow-md;
}

.ui-button[data-variant='neutral'] {
  @apply border-[#D1D5DB] bg-white text-[#111827] hover:shadow-md;
}

.ui-button[data-variant='primary'],
.ui-button[data-variant='selected'] {
  @apply border-[#111827] bg-[#111827] text-white hover:bg-black hover:shadow-md;
}
</style>
