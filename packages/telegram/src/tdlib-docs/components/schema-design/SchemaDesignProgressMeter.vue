<script setup lang="ts">
import {
  schemaProgressLabel,
  schemaProgressStyle,
  type SchemaDesignProgress
} from '../../schemaDesignView.js';

defineProps<{
  progress: SchemaDesignProgress;
}>();
</script>

<template>
  <span
    :data-ready="progress.ready ? 'true' : 'false'"
    :style="schemaProgressStyle(progress)"
    :title="progress.title"
    class="schema-design-progress-meter"
  >
    <span class="schema-design-progress-meter__label">{{ schemaProgressLabel(progress) }}</span>
    <span class="schema-design-progress-meter__track">
      <span class="schema-design-progress-meter__fill"></span>
    </span>
  </span>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-progress-meter {
  @apply grid w-[92px] shrink-0 grid-cols-[auto_minmax(28px,1fr)] items-center gap-1;
}

.schema-design-progress-meter__label {
  @apply font-mono text-[11px] font-semibold leading-none text-neutral-600;
}

.schema-design-progress-meter__track {
  @apply h-1.5 overflow-hidden rounded bg-neutral-200;
}

.schema-design-progress-meter__fill {
  @apply block h-full w-[var(--schema-design-progress)] bg-neutral-500;
}

.schema-design-progress-meter[data-ready='true'] .schema-design-progress-meter__label {
  @apply text-emerald-700;
}

.schema-design-progress-meter[data-ready='true'] .schema-design-progress-meter__track {
  @apply bg-emerald-100;
}

.schema-design-progress-meter[data-ready='true'] .schema-design-progress-meter__fill {
  @apply bg-emerald-600;
}

.schema-design-progress-meter[data-ready='false'] .schema-design-progress-meter__label {
  @apply text-amber-700;
}

.schema-design-progress-meter[data-ready='false'] .schema-design-progress-meter__track {
  @apply bg-amber-100;
}

.schema-design-progress-meter[data-ready='false'] .schema-design-progress-meter__fill {
  @apply bg-amber-500;
}
</style>
