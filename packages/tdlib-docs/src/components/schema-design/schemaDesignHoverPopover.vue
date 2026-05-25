<script setup lang="ts">
defineProps<{
  left: number;
  top: number;
}>();
</script>

<template>
  <div
    :style="{ left: `${String(left)}px`, top: `${String(top)}px` }"
    class="schema-design-hover-popover"
  >
    <slot></slot>
  </div>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-hover-popover {
  @apply fixed z-50 max-w-[420px] rounded border border-neutral-200 bg-white p-2 text-xs leading-snug text-neutral-700 shadow-lg shadow-neutral-200;
}
</style>
