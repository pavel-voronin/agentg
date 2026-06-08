<script setup lang="ts">
import { onMounted } from 'vue';
import SolarArrowRightUpBold from '~icons/solar/arrow-right-up-bold';

import { useLinks } from './links.js';

const { links, loadLinks } = useLinks();

onMounted(() => {
  void loadLinks();
});
</script>

<template>
  <nav v-if="links" class="observability-links" aria-label="Observability tools">
    <a class="observability-links__link" :href="links.metricsUi" target="_blank" rel="noreferrer">
      <SolarArrowRightUpBold class="observability-links__link-icon" aria-hidden="true" />
      <span class="observability-links__link-label">VictoriaMetrics</span>
    </a>
    <a class="observability-links__link" :href="links.grafanaUi" target="_blank" rel="noreferrer">
      <SolarArrowRightUpBold class="observability-links__link-icon" aria-hidden="true" />
      <span class="observability-links__link-label">Grafana</span>
    </a>
    <a class="observability-links__link" :href="links.jaegerUi" target="_blank" rel="noreferrer">
      <SolarArrowRightUpBold class="observability-links__link-icon" aria-hidden="true" />
      <span class="observability-links__link-label">Jaeger</span>
    </a>
  </nav>
</template>

<style scoped>
@reference "tailwindcss";

.observability-links {
  @apply flex flex-wrap items-center justify-end gap-2;
}

.observability-links__link {
  @apply inline-flex h-8 items-center gap-1 rounded border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-950;
}

.observability-links__link-icon {
  @apply size-4 shrink-0;
}

.observability-links__link-label {
  @apply whitespace-nowrap;
}
</style>
