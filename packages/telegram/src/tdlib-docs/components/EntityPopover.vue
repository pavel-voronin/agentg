<script setup lang="ts">
import { computed } from 'vue';

import { hoverPreview } from '../explorerState.js';
import { entityById, isCallableEntity, kindLabels, shortText } from '../schemaIndex.js';

const entity = computed(() =>
  hoverPreview.value === null ? null : (entityById.get(hoverPreview.value.entityId) ?? null)
);
const style = computed(() => ({
  left: `${hoverPreview.value?.left ?? 0}px`,
  top: `${hoverPreview.value?.top ?? 0}px`
}));
</script>

<template>
  <Teleport to="body">
    <aside v-if="entity !== null && hoverPreview !== null" class="entity-popover" :style="style">
      <div class="entity-popover__kind">{{ kindLabels[entity.kind] }}</div>
      <div class="entity-popover__name">{{ entity.name }}</div>
      <p v-if="entity.description.length > 0" class="entity-popover__description">
        {{ shortText(entity.description, 220) }}
      </p>
      <div v-if="entity.kind === 'type'" class="entity-popover__meta">
        {{ entity.constructorNames.length }} constructors
      </div>
      <div v-if="isCallableEntity(entity)" class="entity-popover__meta">
        {{ entity.fields.length }} fields -> {{ entity.resultType }}
      </div>
    </aside>
  </Teleport>
</template>

<style scoped>
@reference '../style.css';

.entity-popover {
  @apply pointer-events-none fixed z-50 max-w-sm rounded border border-neutral-300 bg-white p-3 shadow-lg shadow-neutral-300;
}

.entity-popover__kind {
  @apply text-xs font-semibold uppercase text-neutral-500;
}

.entity-popover__name {
  @apply mt-1 break-words font-mono text-sm text-neutral-950;
}

.entity-popover__description {
  @apply mt-1.5 text-xs leading-snug text-neutral-700;
}

.entity-popover__meta {
  @apply mt-2 font-mono text-xs text-neutral-600;
}
</style>
