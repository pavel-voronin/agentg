<script setup lang="ts">
type UiPagePadding = 'md' | 'none';
type UiPageScroll = 'auto' | 'hidden';

withDefaults(
  defineProps<{
    padding?: UiPagePadding;
    scroll?: UiPageScroll;
  }>(),
  {
    padding: 'md',
    scroll: 'auto'
  }
);
</script>

<template>
  <section class="ui-page" :data-padding="padding" :data-scroll="scroll">
    <slot />
  </section>
</template>

<style scoped>
@reference "tailwindcss";

.ui-page {
  @apply flex h-full min-h-0 w-full flex-1 flex-col rounded-lg border border-zinc-200 bg-white text-zinc-950;
}

.ui-page[data-padding='md'] {
  @apply p-5;
}

.ui-page[data-padding='none'] {
  @apply p-0;
}

.ui-page[data-scroll='auto'] {
  @apply overflow-auto;
}

.ui-page[data-scroll='hidden'] {
  @apply overflow-hidden;
}
</style>
