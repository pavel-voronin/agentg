<script setup lang="ts">
import { computed } from 'vue';

import {
  hideHoverPreview,
  hoverKey,
  isFavoriteEntity,
  openInNewColumn,
  removeFavoriteEntity,
  setHoverKey,
  showHoverPreview,
  toggleInline
} from '../explorerState.js';
import { entityById } from '../schemaIndex.js';

const props = defineProps<{
  entityId: string | null;
  parentInstanceId: string;
  slotKey: string;
  text: string;
  title?: string;
}>();

const emit = defineEmits<{
  activate: [event: MouseEvent];
}>();

const linkKind = computed(() => {
  const entity = props.entityId === null ? null : entityById.get(props.entityId);
  return entity?.kind ?? null;
});
const isFavorite = computed(() => props.entityId !== null && isFavoriteEntity(props.entityId));

function onClick(event: MouseEvent): void {
  if (props.entityId === null) {
    return;
  }

  setHoverKey(null);
  hideHoverPreview();

  emit('activate', event);
  if (event.defaultPrevented) {
    return;
  }

  if (event.shiftKey || event.metaKey || event.ctrlKey) {
    event.stopPropagation();
    openInNewColumn(props.entityId);
    return;
  }

  toggleInline(props.parentInstanceId, props.slotKey, props.entityId);
}

function onPointer(event: MouseEvent): void {
  setHoverKey(props.text);
  if (props.entityId !== null) {
    showHoverPreview(props.entityId, event);
  }
}

function onLeave(): void {
  setHoverKey(null);
  hideHoverPreview();
}

function onFavoriteRemove(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
  if (props.entityId === null) {
    return;
  }

  setHoverKey(null);
  hideHoverPreview();
  removeFavoriteEntity(props.entityId);
}
</script>

<template>
  <span v-if="entityId !== null && isFavorite" class="entity-link-shell">
    <button
      :data-hovered="hoverKey === text ? 'true' : undefined"
      :data-kind="linkKind"
      data-active="true"
      class="entity-link"
      :title="title"
      type="button"
      @click="onClick"
      @mouseenter="onPointer"
      @mouseleave="onLeave"
      @mousemove="onPointer"
    >
      {{ text }}
    </button>
    <button
      :aria-label="`Remove ${text} from favorites`"
      class="entity-link__favorite"
      type="button"
      @mousedown.prevent.stop="onFavoriteRemove"
    >
      <span class="entity-link__favorite-heart">♥</span>
      <span class="entity-link__favorite-remove">×</span>
    </button>
  </span>
  <button
    v-else-if="entityId !== null"
    :data-hovered="hoverKey === text ? 'true' : undefined"
    :data-kind="linkKind"
    data-active="true"
    class="entity-link"
    :title="title"
    type="button"
    @click="onClick"
    @mouseenter="onPointer"
    @mouseleave="onLeave"
    @mousemove="onPointer"
  >
    {{ text }}
  </button>
  <span
    v-else
    :data-hovered="hoverKey === text ? 'true' : undefined"
    data-active="false"
    class="entity-link"
    @mouseenter="onPointer"
    @mouseleave="onLeave"
  >
    {{ text }}
  </span>
</template>

<style scoped>
@reference '../style.css';

.entity-link {
  @apply inline-flex max-w-full items-center rounded px-1 py-0 font-mono text-[0.92em] leading-snug;
}

.entity-link-shell {
  @apply inline-flex max-w-full items-stretch;
}

.entity-link-shell .entity-link {
  @apply rounded-r-none border-r-0;
}

.entity-link[data-active='true'] {
  @apply appearance-none border border-l-2 border-neutral-200 bg-white text-sky-700 hover:border-neutral-300 hover:bg-sky-50 hover:text-sky-900;
}

.entity-link[data-active='false'] {
  @apply border border-transparent bg-transparent text-neutral-700;
}

.entity-link[data-active='true'][data-hovered='true'] {
  @apply border-yellow-300 bg-yellow-200 text-neutral-950;
}

.entity-link[data-active='false'][data-hovered='true'] {
  @apply bg-yellow-100 text-neutral-950;
}

.entity-link__favorite {
  @apply inline-flex items-center rounded-r border border-l-0 border-neutral-200 bg-white px-1 py-0 font-mono text-[0.92em] leading-snug text-red-600 outline-none hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none;
}

.entity-link__favorite-remove {
  @apply hidden;
}

.entity-link__favorite:hover .entity-link__favorite-heart {
  @apply hidden;
}

.entity-link__favorite:hover .entity-link__favorite-remove {
  @apply inline;
}

.entity-link[data-active='true'][data-kind='type'],
.entity-link[data-active='true'][data-kind='type']:hover,
.entity-link[data-active='true'][data-kind='type'][data-hovered='true'] {
  @apply border-l-sky-500;
}

.entity-link[data-active='true'][data-kind='constructor'],
.entity-link[data-active='true'][data-kind='constructor']:hover,
.entity-link[data-active='true'][data-kind='constructor'][data-hovered='true'] {
  @apply border-l-emerald-500;
}

.entity-link[data-active='true'][data-kind='update'],
.entity-link[data-active='true'][data-kind='update']:hover,
.entity-link[data-active='true'][data-kind='update'][data-hovered='true'] {
  @apply border-l-rose-500;
}

.entity-link[data-active='true'][data-kind='function'],
.entity-link[data-active='true'][data-kind='function']:hover,
.entity-link[data-active='true'][data-kind='function'][data-hovered='true'] {
  @apply border-l-amber-500;
}

.entity-link[data-active='true'][data-kind='scalar'],
.entity-link[data-active='true'][data-kind='scalar']:hover,
.entity-link[data-active='true'][data-kind='scalar'][data-hovered='true'] {
  @apply border-l-neutral-500;
}
</style>
