<script setup lang="ts">
import { computed } from 'vue';

import { cardsForSlot, hideHoverPreview, setHoverKey } from '../../explorerState.js';
import { resolveEntityId } from '../../schemaIndex.js';
import {
  schemaProgressForEntry,
  type SchemaDesignSourceFocusTarget,
  type SchemaDesignSourceHoverTarget,
  type SchemaDesignTableFocusRequest,
  type SchemaDesignTableHoverTarget
} from '../../schemaDesignView.js';
import type {
  StorageReviewEntry,
  StorageSchemaConstructorDesign,
  StorageSchemaTable
} from '../../storageReviewTypes.js';
import EntityCard from '../EntityCard.vue';
import EntityLink from '../EntityLink.vue';
import StorageReviewInfoCard from '../StorageReviewInfoCard.vue';
import SchemaDesignConstructorList from './SchemaDesignConstructorList.vue';

const props = defineProps<{
  constructors: StorageSchemaConstructorDesign[];
  entry: StorageReviewEntry;
  expandedReviewIndexes: number[];
  focusTarget: SchemaDesignSourceFocusTarget | null;
  sourceHoverTarget: SchemaDesignSourceHoverTarget | null;
  tables: StorageSchemaTable[];
  tableHoverTarget: SchemaDesignTableHoverTarget | null;
}>();

const emit = defineEmits<{
  closeReview: [reviewIndex: number];
  sourceHover: [target: SchemaDesignSourceHoverTarget | null];
  tableFocus: [target: SchemaDesignTableFocusRequest];
  tableHover: [target: SchemaDesignTableHoverTarget | null];
}>();

const progress = computed(() => schemaProgressForEntry(props.entry));
const typeCards = computed(() => cardsForSlot(typeDetailInstanceId(), typeDetailSlot()));

function typeEntityId(): string | null {
  return resolveEntityId(props.entry.type);
}

function typeDetailInstanceId(): string {
  return `schema-type-detail:${props.entry.type}`;
}

function typeDetailSlot(): string {
  return `tdlib-type:${props.entry.type}`;
}

function onTypeActivate(): void {
  setHoverKey(null);
  hideHoverPreview();
}
</script>

<template>
  <article class="schema-design-type-detail-card">
    <header class="schema-design-type-detail-card__header">
      <div class="schema-design-type-detail-card__heading">
        <span class="schema-design-type-detail-card__kind">schema type</span>
        <h3 class="schema-design-type-detail-card__title">{{ entry.type }}</h3>
      </div>
    </header>
    <div class="schema-design-type-detail-card__facts">
      <span class="schema-design-type-detail-card__label">TDLib type</span>
      <span class="schema-design-type-detail-card__value">
        <EntityLink
          :entity-id="typeEntityId()"
          :parent-instance-id="typeDetailInstanceId()"
          :slot-key="typeDetailSlot()"
          :text="entry.type"
          @activate="onTypeActivate"
        />
      </span>
      <span class="schema-design-type-detail-card__label">Storage</span>
      <span class="schema-design-type-detail-card__value">{{ entry.storage }}</span>
      <span class="schema-design-type-detail-card__label">Schema target</span>
      <span class="schema-design-type-detail-card__value">{{ entry.storageTarget }}</span>
      <span class="schema-design-type-detail-card__label">Progress</span>
      <span class="schema-design-type-detail-card__value">{{ progress.title }}</span>
    </div>
    <div v-if="typeCards.length > 0" class="schema-design-type-detail-card__inline-cards">
      <EntityCard v-for="card in typeCards" :key="card.instanceId" :depth="1" :instance="card" />
    </div>
    <div v-if="expandedReviewIndexes.length > 0" class="schema-design-type-detail-card__reviews">
      <StorageReviewInfoCard
        v-for="reviewIndex in expandedReviewIndexes"
        :key="reviewIndex"
        :compact="false"
        :entry="entry"
        :review-index="reviewIndex"
        @close="emit('closeReview', reviewIndex)"
      />
    </div>
    <section class="schema-design-type-detail-card__constructors">
      <SchemaDesignConstructorList
        :constructors="constructors"
        :entry="entry"
        :focus-target="focusTarget"
        :source-hover-target="sourceHoverTarget"
        :tables="tables"
        :table-hover-target="tableHoverTarget"
        @source-hover="emit('sourceHover', $event)"
        @table-focus="emit('tableFocus', $event)"
        @table-hover="emit('tableHover', $event)"
      />
    </section>
  </article>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-type-detail-card {
  @apply rounded border border-l-4 border-neutral-200 border-l-sky-300 bg-white p-3;
}

.schema-design-type-detail-card__header {
  @apply flex items-start justify-between gap-2;
}

.schema-design-type-detail-card__heading {
  @apply min-w-0;
}

.schema-design-type-detail-card__kind {
  @apply text-[11px] font-semibold uppercase leading-none text-neutral-500;
}

.schema-design-type-detail-card__title {
  @apply m-0 mt-1 break-words font-mono text-lg font-semibold leading-tight text-neutral-950;
}

.schema-design-type-detail-card__facts {
  @apply mt-3 grid grid-cols-[96px_minmax(0,1fr)] gap-x-2 gap-y-1;
}

.schema-design-type-detail-card__label {
  @apply text-[11px] font-semibold uppercase leading-snug text-neutral-500;
}

.schema-design-type-detail-card__value {
  @apply min-w-0 break-words font-mono text-xs text-neutral-800;
}

.schema-design-type-detail-card__inline-cards {
  @apply mt-2 flex flex-col gap-2;
}

.schema-design-type-detail-card__reviews {
  @apply mt-2 flex flex-col gap-2;
}

.schema-design-type-detail-card__constructors {
  @apply mt-3 border-t border-neutral-200 pt-3;
}
</style>
