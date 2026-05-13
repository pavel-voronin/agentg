<script setup lang="ts">
import { computed } from 'vue';

import {
  cardsForSlot,
  closeCard,
  embedConstructorInOwnerType,
  hoverKey,
  isFavoriteEntity,
  setHoverKey,
  toggleFavoriteEntity
} from '../explorerState.js';
import {
  entityById,
  isCallableEntity,
  kindLabels,
  referencesByName,
  resolveEntityId,
  typeUsageLandscapesByName
} from '../schemaIndex.js';
import type { CardInstance, TdlibCallableEntity } from '../types.js';
import EntityLink from './EntityLink.vue';
import TypeRef from './TypeRef.vue';
import UsageLandscape from './UsageLandscape.vue';

defineOptions({ name: 'EntityCard' });

const props = defineProps<{
  depth: number;
  instance: CardInstance;
}>();

const entity = computed(() => entityById.get(props.instance.entityId) ?? null);
const callable = computed(() => {
  const value = entity.value;
  return value !== null && isCallableEntity(value) ? value : null;
});
const references = computed(() => {
  const value = entity.value;
  if (value === null || value.kind === 'type') {
    return [];
  }

  return (referencesByName.get(value.name) ?? [])
    .filter((entityId) => entityId !== value.id)
    .slice(0, 8)
    .map((entityId) => entityById.get(entityId))
    .filter((item) => item !== undefined);
});
const typeUsage = computed(() => {
  const value = entity.value;
  return value?.kind === 'type' ? (typeUsageLandscapesByName.get(value.name) ?? null) : null;
});
const isFavorite = computed(() => {
  const value = entity.value;
  return value !== null && isFavoriteEntity(value.id);
});
const constructorOwnerTypeId = computed(() => {
  const value = entity.value;
  if (value?.kind !== 'constructor') {
    return null;
  }

  const ownerTypeId = resolveEntityId(value.resultType);
  const ownerType = ownerTypeId === null ? undefined : entityById.get(ownerTypeId);
  return ownerType?.kind === 'type' ? ownerTypeId : null;
});
const procedureResultEntityId = computed(() => {
  const value = callable.value;
  if (value?.kind !== 'function') {
    return null;
  }

  return resolveEntityId(value.resultType);
});
const errorEntityId = resolveEntityId('Error');
const fieldSectionTitle = computed(() =>
  entity.value?.kind === 'function' ? 'Parameters' : 'Fields'
);
const emptyFieldText = computed(() =>
  entity.value?.kind === 'function' ? 'No parameters' : 'No fields'
);
const fieldDescriptionFallback = computed(() =>
  entity.value?.kind === 'function'
    ? 'No TDLib parameter description.'
    : 'No TDLib field description.'
);

function constructorEntityId(name: string): string | null {
  return resolveEntityId(name);
}

function constructorFieldCount(name: string): number {
  const constructorId = constructorEntityId(name);
  const constructor = constructorId === null ? undefined : entityById.get(constructorId);
  return constructor !== undefined && isCallableEntity(constructor) ? constructor.fields.length : 0;
}

function fieldSlot(fieldName: string): string {
  return `field:${fieldName}`;
}

function constructorSlot(name: string): string {
  return `constructor:${name}`;
}

function referenceSlot(name: string): string {
  return `reference:${name}`;
}

function resultSlot(value: TdlibCallableEntity): string {
  return `result:${value.resultType}`;
}

function procedureReturnSlot(name: string): string {
  return `procedure-return:${name}`;
}

function onConstructorOwnerTypeActivate(event: MouseEvent): void {
  const ownerTypeId = constructorOwnerTypeId.value;
  if (ownerTypeId === null || event.shiftKey || event.metaKey || event.ctrlKey) {
    return;
  }

  event.preventDefault();
  embedConstructorInOwnerType(props.instance.instanceId, ownerTypeId);
}
</script>

<template>
  <article v-if="entity !== null" :data-depth="depth" :data-kind="entity.kind" class="entity-card">
    <header class="entity-card__header">
      <div class="entity-card__heading">
        <span
          v-if="
            entity.kind === 'constructor' && callable !== null && constructorOwnerTypeId !== null
          "
          class="entity-card__owner-kind"
        >
          constructor of type
          <EntityLink
            :entity-id="constructorOwnerTypeId"
            :parent-instance-id="instance.instanceId"
            :slot-key="resultSlot(callable)"
            :text="callable.resultType"
            title="Open owner type and embed this constructor. Shift, Command, or Control opens owner type in a new column."
            @activate="onConstructorOwnerTypeActivate"
          />
        </span>
        <span v-else class="entity-card__kind">{{ kindLabels[entity.kind] }}</span>
        <h2 class="entity-card__title">{{ entity.name }}</h2>
      </div>
      <div class="entity-card__controls">
        <button
          :aria-pressed="isFavorite"
          :data-active="isFavorite ? 'true' : undefined"
          class="entity-card__control"
          type="button"
          @click.stop="toggleFavoriteEntity(entity.id)"
        >
          {{ isFavorite ? '♥' : '♡' }}
        </button>
        <button
          class="entity-card__control"
          title="Close card"
          type="button"
          @click.stop="closeCard(instance.instanceId)"
        >
          ×
        </button>
      </div>
    </header>

    <p v-if="entity.description.length > 0" class="entity-card__description">
      {{ entity.description }}
    </p>

    <UsageLandscape
      v-if="typeUsage !== null"
      :landscape="typeUsage"
      :parent-instance-id="instance.instanceId"
    >
      <template #inline-card="{ slotKey }">
        <div
          v-if="cardsForSlot(instance.instanceId, slotKey).length > 0"
          class="entity-card__inline-cards"
        >
          <EntityCard
            v-for="child in cardsForSlot(instance.instanceId, slotKey)"
            :key="child.instanceId"
            :depth="depth + 1"
            :instance="child"
          />
        </div>
      </template>
    </UsageLandscape>

    <section v-if="callable !== null && entity.kind === 'function'" class="entity-card__section">
      <div class="entity-card__return-row">
        <span class="entity-card__return-arrow">&rarr;</span>
        <span class="entity-card__return-outcome">
          <EntityLink
            :entity-id="procedureResultEntityId"
            :parent-instance-id="instance.instanceId"
            :slot-key="procedureReturnSlot('success')"
            :text="callable.resultType"
          />
        </span>

        <span v-if="errorEntityId !== null" class="entity-card__return-separator">/</span>

        <span v-if="errorEntityId !== null" class="entity-card__return-outcome">
          <EntityLink
            :entity-id="errorEntityId"
            :parent-instance-id="instance.instanceId"
            :slot-key="procedureReturnSlot('failure')"
            text="Error"
          />
        </span>
      </div>

      <div
        v-if="cardsForSlot(instance.instanceId, procedureReturnSlot('success')).length > 0"
        class="entity-card__inline-cards"
      >
        <EntityCard
          v-for="child in cardsForSlot(instance.instanceId, procedureReturnSlot('success'))"
          :key="child.instanceId"
          :depth="depth + 1"
          :instance="child"
        />
      </div>

      <div
        v-if="cardsForSlot(instance.instanceId, procedureReturnSlot('failure')).length > 0"
        class="entity-card__inline-cards"
      >
        <EntityCard
          v-for="child in cardsForSlot(instance.instanceId, procedureReturnSlot('failure'))"
          :key="child.instanceId"
          :depth="depth + 1"
          :instance="child"
        />
      </div>
    </section>

    <div
      v-if="
        callable !== null &&
        entity.kind !== 'constructor' &&
        entity.kind !== 'function' &&
        entity.kind !== 'update'
      "
      class="entity-card__signature"
    >
      <span class="entity-card__signature-name">{{ callable.name }}</span>
      <span class="entity-card__signature-arrow">=</span>
      <TypeRef
        :parent-instance-id="instance.instanceId"
        :slot-key="resultSlot(callable)"
        :type-name="callable.resultType"
      />
    </div>

    <div
      v-if="
        callable !== null &&
        entity.kind !== 'constructor' &&
        entity.kind !== 'function' &&
        entity.kind !== 'update' &&
        cardsForSlot(instance.instanceId, resultSlot(callable)).length > 0
      "
      class="entity-card__inline-cards"
    >
      <EntityCard
        v-for="child in cardsForSlot(instance.instanceId, resultSlot(callable))"
        :key="child.instanceId"
        :depth="depth + 1"
        :instance="child"
      />
    </div>

    <section v-if="entity.kind === 'type'" class="entity-card__section">
      <h3 class="entity-card__section-title">Constructors</h3>
      <div class="entity-card__constructor-list">
        <div
          v-for="constructorName in entity.constructorNames"
          :key="constructorName"
          class="entity-card__constructor-item"
        >
          <div class="entity-card__constructor-row">
            <EntityLink
              :entity-id="constructorEntityId(constructorName)"
              :parent-instance-id="instance.instanceId"
              :slot-key="constructorSlot(constructorName)"
              :text="constructorName"
            />
            <span class="entity-card__constructor-count">
              {{ constructorFieldCount(constructorName) }} fields
            </span>
          </div>

          <div
            v-if="cardsForSlot(instance.instanceId, constructorSlot(constructorName)).length > 0"
            class="entity-card__inline-cards"
          >
            <EntityCard
              v-for="child in cardsForSlot(instance.instanceId, constructorSlot(constructorName))"
              :key="child.instanceId"
              :depth="depth + 1"
              :instance="child"
            />
          </div>
        </div>
      </div>
    </section>

    <section v-if="callable !== null" class="entity-card__section">
      <h3 class="entity-card__section-title">{{ fieldSectionTitle }}</h3>
      <div v-if="callable.fields.length > 0" class="entity-card__field-list">
        <div
          v-for="field in callable.fields"
          :key="field.name"
          :data-focused="instance.focusField === field.name ? 'true' : undefined"
          class="entity-card__field-item"
        >
          <div class="entity-card__field-row">
            <div
              :data-hovered="hoverKey === field.name ? 'true' : undefined"
              class="entity-card__field-name"
              @mouseenter="setHoverKey(field.name)"
              @mouseleave="setHoverKey(null)"
            >
              {{ field.name }}
            </div>
            <div class="entity-card__field-type">
              <TypeRef
                :parent-instance-id="instance.instanceId"
                :slot-key="fieldSlot(field.name)"
                :type-name="field.type"
              />
            </div>
            <p class="entity-card__field-description">
              {{ field.description.length > 0 ? field.description : fieldDescriptionFallback }}
            </p>
          </div>

          <div
            v-if="cardsForSlot(instance.instanceId, fieldSlot(field.name)).length > 0"
            class="entity-card__inline-cards"
          >
            <EntityCard
              v-for="child in cardsForSlot(instance.instanceId, fieldSlot(field.name))"
              :key="child.instanceId"
              :depth="depth + 1"
              :instance="child"
            />
          </div>
        </div>
      </div>
      <div v-else class="entity-card__empty">{{ emptyFieldText }}</div>
    </section>

    <section v-if="references.length > 0" class="entity-card__section">
      <h3 class="entity-card__section-title">Referenced by</h3>
      <div class="entity-card__reference-list">
        <div
          v-for="reference in references"
          :key="reference.id"
          class="entity-card__reference-item"
        >
          <div class="entity-card__reference-row">
            <EntityLink
              :entity-id="reference.id"
              :parent-instance-id="instance.instanceId"
              :slot-key="referenceSlot(reference.name)"
              :text="reference.name"
            />
            <span class="entity-card__reference-kind">{{ kindLabels[reference.kind] }}</span>
          </div>

          <div
            v-if="cardsForSlot(instance.instanceId, referenceSlot(reference.name)).length > 0"
            class="entity-card__inline-cards"
          >
            <EntityCard
              v-for="child in cardsForSlot(instance.instanceId, referenceSlot(reference.name))"
              :key="child.instanceId"
              :depth="depth + 1"
              :instance="child"
            />
          </div>
        </div>
      </div>
    </section>
  </article>
</template>

<style scoped>
@reference '../style.css';

.entity-card {
  @apply rounded border border-l-4 border-neutral-200 bg-white p-3;
}

.entity-card[data-depth='1'] {
  @apply border-neutral-300 bg-neutral-50;
}

.entity-card[data-depth='2'] {
  @apply border-neutral-300;
}

.entity-card[data-kind='type'] {
  @apply border-l-sky-500;
}

.entity-card[data-kind='constructor'] {
  @apply border-l-emerald-500;
}

.entity-card[data-kind='update'] {
  @apply border-l-rose-500;
}

.entity-card[data-kind='function'] {
  @apply border-l-amber-500;
}

.entity-card[data-kind='scalar'] {
  @apply border-l-neutral-500;
}

.entity-card__header {
  @apply flex items-start justify-between gap-2;
}

.entity-card__heading {
  @apply min-w-0;
}

.entity-card__kind {
  @apply text-[11px] font-semibold uppercase leading-none text-neutral-500;
}

.entity-card__owner-kind {
  @apply inline-flex max-w-full flex-wrap items-center gap-1 text-[11px] font-semibold leading-none text-neutral-500;
}

.entity-card__title {
  @apply m-0 mt-1 break-words font-mono text-lg font-semibold leading-tight text-neutral-950;
}

.entity-card__controls {
  @apply flex shrink-0 gap-2;
}

.entity-card__control {
  @apply h-7 w-7 rounded border border-neutral-300 bg-white text-sm text-neutral-600 hover:border-neutral-500 hover:text-neutral-950;
}

.entity-card__control[data-active='true'] {
  @apply border-red-500 bg-white text-red-600;
}

.entity-card__description {
  @apply m-0 mt-0.5 mb-2.5 max-w-5xl text-sm leading-snug text-neutral-700;
}

.entity-card__signature {
  @apply mt-1 flex flex-wrap items-center gap-1.5 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm;
}

.entity-card__signature-name {
  @apply font-mono text-neutral-900;
}

.entity-card__signature-arrow {
  @apply text-neutral-500;
}

.entity-card__return-row {
  @apply flex flex-wrap items-center gap-2;
}

.entity-card__return-arrow {
  @apply text-sm leading-none text-neutral-500;
}

.entity-card__return-separator {
  @apply text-sm leading-none text-neutral-400;
}

.entity-card__return-outcome {
  @apply inline-flex min-w-0 items-center gap-1;
}

.entity-card__section {
  @apply mt-3;
}

.entity-card__section-title {
  @apply mb-1 text-[11px] font-semibold uppercase leading-none text-neutral-500;
}

.entity-card__constructor-list {
  @apply flex flex-col gap-1;
}

.entity-card__constructor-item {
  @apply min-w-0;
}

.entity-card__constructor-row {
  @apply flex min-w-0 flex-wrap items-center gap-2;
}

.entity-card__constructor-count {
  @apply shrink-0 text-xs text-neutral-500;
}

.entity-card__field-list {
  @apply flex flex-col;
}

.entity-card__field-item {
  @apply border-b border-neutral-200 px-1 py-1.5 last:border-b-0;
}

.entity-card__field-item[data-focused='true'] {
  @apply bg-yellow-50;
}

.entity-card__field-row {
  @apply grid grid-cols-[minmax(112px,180px)_minmax(96px,180px)_minmax(0,1fr)] items-start gap-x-2 gap-y-1;
}

.entity-card__field-name {
  @apply min-w-0 break-words rounded px-1 font-mono text-sm leading-snug text-neutral-900;
}

.entity-card__field-name[data-hovered='true'] {
  @apply bg-yellow-200 text-neutral-950;
}

.entity-card__field-type {
  @apply min-w-0 text-sm leading-snug;
}

.entity-card__field-description {
  @apply m-0 min-w-0 text-xs leading-snug text-neutral-700;
}

.entity-card__empty {
  @apply rounded border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-500;
}

.entity-card__reference-list {
  @apply flex flex-col gap-1;
}

.entity-card__reference-item {
  @apply rounded border border-neutral-200 bg-white px-2 py-0.5;
}

.entity-card__reference-row {
  @apply flex flex-wrap items-center gap-1.5;
}

.entity-card__reference-kind {
  @apply text-xs uppercase text-neutral-500;
}

.entity-card__inline-cards {
  @apply mt-1 flex w-full flex-col gap-2;
}

@media (max-width: 900px) {
  .entity-card__field-row {
    @apply grid-cols-1;
  }
}
</style>
