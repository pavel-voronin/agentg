<script setup lang="ts">
type TabView = {
  id: string;
  label: string;
};

defineProps<{
  activeId: string;
  navigationLabel: string;
  tabs: readonly TabView[];
  variant: 'main' | 'nested';
}>();

const emit = defineEmits<{
  select: [id: string];
}>();
</script>

<template>
  <nav class="telemetry-tab-nav" :aria-label="navigationLabel" :data-variant="variant">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      class="telemetry-tab-nav__tab"
      :aria-selected="activeId === tab.id"
      :data-active="activeId === tab.id ? 'true' : undefined"
      @click="emit('select', tab.id)"
    >
      {{ tab.label }}
    </button>
  </nav>
</template>

<style scoped>
@reference "tailwindcss";

.telemetry-tab-nav {
  @apply flex gap-1 overflow-x-auto border-b border-zinc-200;
}

.telemetry-tab-nav[data-variant='main'] {
  @apply mt-4;
}

.telemetry-tab-nav[data-variant='nested'] {
  @apply mt-4;
}

.telemetry-tab-nav__tab {
  @apply shrink-0 border-b-2 border-transparent px-3 py-2 font-medium text-zinc-500 transition-colors hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300;
}

.telemetry-tab-nav[data-variant='main'] .telemetry-tab-nav__tab {
  @apply text-sm;
}

.telemetry-tab-nav[data-variant='nested'] .telemetry-tab-nav__tab {
  @apply text-xs font-semibold uppercase;
}

.telemetry-tab-nav__tab[data-active='true'] {
  @apply border-zinc-950 text-zinc-950;
}
</style>
