<script setup lang="ts">
import { nextTick, ref } from 'vue';

import { resolveEntityId } from '../../schemaIndex.js';
import type {
  SchemaDesignKvMapping,
  SchemaDesignSourceFocusRequest,
  SchemaDesignSourceHoverTarget,
  SchemaDesignSourceReference,
  SchemaDesignUpdateFocusRequest
} from '../../schemaDesignView.js';
import { schemaSourceReferenceMatchesTarget } from '../../schemaDesignView.js';
import EntityLink from '../EntityLink.vue';

const props = defineProps<{
  mappings: SchemaDesignKvMapping[];
  parentInstanceId: string;
  sourceHoverTarget: SchemaDesignSourceHoverTarget | null;
}>();

const emit = defineEmits<{
  sourceFocus: [target: SchemaDesignSourceFocusRequest];
  sourceHover: [target: SchemaDesignSourceHoverTarget | null];
  updateFocus: [target: SchemaDesignUpdateFocusRequest];
}>();

const rootElement = ref<HTMLElement | null>(null);

function mappingSlot(mapping: SchemaDesignKvMapping): string {
  return `schema-table-kv-entry:${mapping.key}`;
}

function sourceSlot(source: SchemaDesignSourceReference): string {
  return `schema-table-kv-entry-source:${source.raw}`;
}

function sourceHovered(source: SchemaDesignSourceReference): boolean {
  return schemaSourceReferenceMatchesTarget(source, props.sourceHoverTarget);
}

async function focusList(): Promise<void> {
  await nextTick();
  const element = rootElement.value;
  if (element === null) {
    return;
  }

  element.scrollIntoView({ block: 'nearest' });
  element.focus({ preventScroll: true });
}

function focusMapping(mapping: SchemaDesignKvMapping): void {
  const source = mapping.keySources[0] ?? mapping.valueSources[0];
  if (source !== undefined) {
    focusSource(source);
  }
}

function focusSource(source: SchemaDesignSourceReference): void {
  if (source.type === 'Update') {
    emit('updateFocus', {
      update: source.constructor,
      ...(source.field === undefined ? {} : { field: source.field })
    });
    return;
  }

  emit('sourceFocus', {
    constructor: source.constructor,
    ...(source.field === undefined ? {} : { field: source.field }),
    type: source.type
  });
}

function onSourceActivate(
  event: MouseEvent,
  source: SchemaDesignSourceReference
): void {
  event.preventDefault();
  focusSource(source);
}

function onSourceMouseEnter(source: SchemaDesignSourceReference): void {
  emit('sourceHover', {
    constructor: source.constructor,
    ...(source.field === undefined ? {} : { field: source.field }),
    type: source.type
  });
}

function onSourceMouseLeave(): void {
  emit('sourceHover', null);
}

defineExpose({
  focusList
});
</script>

<template>
  <section ref="rootElement" class="schema-design-kv-entry-list" tabindex="-1">
    <h4 class="schema-design-kv-entry-list__title">KV entries</h4>
    <div class="schema-design-kv-entry-list__items">
      <article
        v-for="mapping in mappings"
        :key="mapping.key"
        class="schema-design-kv-entry-list__item"
      >
        <div class="schema-design-kv-entry-list__pair">
          <span class="schema-design-kv-entry-list__prefix">key</span>
          <button
            class="schema-design-kv-entry-list__key"
            type="button"
            @click="focusMapping(mapping)"
          >
            {{ mapping.key }}
          </button>
          <span class="schema-design-kv-entry-list__prefix">value</span>
          <span class="schema-design-kv-entry-list__value">
            <span
              v-for="source in mapping.valueSources"
              :key="source.raw"
              :data-hovered="sourceHovered(source) ? 'true' : undefined"
              class="schema-design-kv-entry-list__source"
              @mouseenter="onSourceMouseEnter(source)"
              @mouseleave="onSourceMouseLeave"
            >
              <EntityLink
                :entity-id="resolveEntityId(source.constructor)"
                :parent-instance-id="mappingSlot(mapping)"
                :slot-key="sourceSlot(source)"
                :text="source.constructor"
                @activate="onSourceActivate($event, source)"
              />
              <button
                v-if="source.field !== undefined"
                class="schema-design-kv-entry-list__field"
                type="button"
                @click="focusSource(source)"
              >
                .{{ source.field }}
              </button>
            </span>
          </span>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-kv-entry-list {
  @apply mt-3;
}

.schema-design-kv-entry-list__title {
  @apply mb-1 text-[11px] font-semibold uppercase leading-none text-neutral-500;
}

.schema-design-kv-entry-list__items {
  @apply flex flex-col;
}

.schema-design-kv-entry-list__item {
  @apply border-b border-neutral-200 px-1 py-1.5 hover:bg-neutral-50;
}

.schema-design-kv-entry-list__pair {
  @apply grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-2 gap-y-1 overflow-hidden;
}

.schema-design-kv-entry-list__prefix {
  @apply font-mono text-[0.76em] leading-snug text-neutral-500;
}

.schema-design-kv-entry-list__source {
  @apply mr-1 inline-flex max-w-full min-w-0 items-baseline;
}

.schema-design-kv-entry-list__source[data-hovered='true'] {
  @apply rounded bg-sky-100;
}

.schema-design-kv-entry-list__key {
  @apply inline-flex min-w-0 max-w-full appearance-none items-center justify-self-start truncate rounded border border-neutral-200 bg-white px-1 py-0 text-left font-mono text-[0.92em] leading-snug text-neutral-600 outline-none hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900;
}

.schema-design-kv-entry-list__value {
  @apply flex min-w-0 flex-wrap items-baseline overflow-hidden;
}

.schema-design-kv-entry-list__field {
  @apply inline-flex max-w-full appearance-none items-center rounded border border-l-0 border-neutral-200 bg-white px-1 py-0 text-left font-mono text-[0.92em] leading-snug text-neutral-600 outline-none hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900;
}

</style>
