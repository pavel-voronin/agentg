<script setup lang="ts">
import { computed } from 'vue';

import {
  activeColumnIsEmpty,
  favoriteEntityIds,
  openInActiveColumn,
  openInNewColumn
} from '../explorerState.js';
import { entityById } from '../schemaIndex.js';
import type { TdlibEntity } from '../types.js';
import EntityLink from './EntityLink.vue';

const emit = defineEmits<{
  activate: [];
}>();

const favoriteEntities = computed<TdlibEntity[]>(() =>
  favoriteEntityIds.value
    .map((entityId) => entityById.get(entityId))
    .filter((entity): entity is TdlibEntity => entity !== undefined)
);

function openFavorite(entityId: string, event: MouseEvent): void {
  event.preventDefault();
  if ((event.shiftKey || event.metaKey || event.ctrlKey) && !activeColumnIsEmpty.value) {
    openInNewColumn(entityId);
    emit('activate');
    return;
  }

  openInActiveColumn(entityId);
  emit('activate');
}
</script>

<template>
  <nav v-if="favoriteEntities.length > 0" class="favorite-bar" aria-label="Favorite TDLib entities">
    <span
      v-for="entity in favoriteEntities"
      :key="entity.id"
      class="favorite-bar__item"
      @mousedown.prevent
    >
      <EntityLink
        :entity-id="entity.id"
        parent-instance-id="favorites"
        :slot-key="`favorite:${entity.id}`"
        :text="entity.name"
        @activate="openFavorite(entity.id, $event)"
      />
    </span>
  </nav>
</template>

<style scoped>
@reference '../style.css';

.favorite-bar {
  @apply flex max-w-full shrink-0 flex-wrap items-center gap-1 overflow-x-hidden overflow-y-visible border-b border-neutral-100 bg-neutral-50 p-1.5;
}

.favorite-bar__item {
  @apply inline-flex max-w-full items-center;
}
</style>
