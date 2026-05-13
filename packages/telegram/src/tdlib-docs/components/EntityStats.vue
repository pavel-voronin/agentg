<script setup lang="ts">
import { tdlibCounts, tdlibSource } from '../schemaIndex.js';
</script>

<template>
  <section class="entity-stats">
    <div class="entity-stats__grid">
      <div class="entity-stats__item">
        <span class="entity-stats__value">{{ tdlibCounts.types }}</span>
        <span class="entity-stats__label">types</span>
      </div>
      <div class="entity-stats__item">
        <span class="entity-stats__value">{{ tdlibCounts.constructors }}</span>
        <span class="entity-stats__label">constructors</span>
      </div>
      <div class="entity-stats__item">
        <span class="entity-stats__value">{{ tdlibCounts.updates }}</span>
        <span class="entity-stats__label">updates</span>
      </div>
      <div class="entity-stats__item">
        <span class="entity-stats__value">{{ tdlibCounts.functions }}</span>
        <span class="entity-stats__label">procedures</span>
      </div>
    </div>
    <a class="entity-stats__source" :href="tdlibSource.url" rel="noreferrer" target="_blank">
      {{ tdlibSource.commit.slice(0, 12) }}
    </a>
  </section>
</template>

<style scoped>
@reference '../style.css';

.entity-stats {
  @apply mt-5 border-t border-neutral-800 pt-4;
}

.entity-stats__grid {
  @apply grid grid-cols-2 gap-2;
}

.entity-stats__item {
  @apply rounded-md border border-neutral-800 bg-neutral-900 p-3;
}

.entity-stats__value {
  @apply block font-mono text-lg text-emerald-300;
}

.entity-stats__label {
  @apply block text-xs uppercase text-neutral-500;
}

.entity-stats__source {
  @apply mt-3 block truncate font-mono text-xs text-neutral-500 hover:text-amber-200;
}
</style>
