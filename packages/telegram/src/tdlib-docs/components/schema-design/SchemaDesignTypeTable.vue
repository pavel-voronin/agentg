<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

import {
  schemaFocusConstructor,
  type SchemaDesignSourceFocusTarget,
  type SchemaDesignSourceHoverTarget,
  type SchemaDesignTableFocusRequest,
  type SchemaDesignTableHoverTarget
} from '../../schemaDesignView.js';
import type { StorageReviewEntry, StorageSchemaTable } from '../../storageReviewTypes.js';
import SchemaDesignScrollIndicator from './SchemaDesignScrollIndicator.vue';
import SchemaDesignTypeRow from './SchemaDesignTypeRow.vue';
import { useSchemaDesignScrollIndicator } from './schemaDesignScrollIndicator.js';

const props = defineProps<{
  entries: StorageReviewEntry[];
  expandedReviewKeys: Set<string>;
  expandedTypeNames: Set<string>;
  focusTarget: SchemaDesignSourceFocusTarget | null;
  maxReviewNoteCount: number;
  scrollTop: number;
  sourceHoverTarget: SchemaDesignSourceHoverTarget | null;
  tables: StorageSchemaTable[];
  tableHoverTarget: SchemaDesignTableHoverTarget | null;
  totalEntryCount: number;
}>();

const emit = defineEmits<{
  scrollChange: [scrollTop: number];
  sourceHover: [target: SchemaDesignSourceHoverTarget | null];
  tableFocus: [target: SchemaDesignTableFocusRequest];
  tableHover: [target: SchemaDesignTableHoverTarget | null];
  typeExpandedChange: [typeName: string, expanded: boolean];
  typeReviewClose: [typeName: string, reviewIndex: number];
  typeReviewToggle: [typeName: string, reviewIndex: number];
}>();

const shellElement = ref<HTMLElement | null>(null);
const { scrollIndicatorScrollable, scrollIndicatorStyle, updateScrollIndicator } =
  useSchemaDesignScrollIndicator(
    shellElement,
    '.schema-design-type-table__table',
    '.schema-design-type-table__head'
  );

watch(
  () => [props.scrollTop, props.entries.length] as const,
  async ([scrollTop]) => {
    await nextTick();
    if (shellElement.value !== null && shellElement.value.scrollTop !== scrollTop) {
      shellElement.value.scrollTop = scrollTop;
    }
    updateScrollIndicator();
  },
  { immediate: true }
);

watch(
  () => props.focusTarget?.id,
  async () => {
    if (props.focusTarget === null) {
      return;
    }

    await nextTick();
    await nextTick();
    scrollToFocusTarget(props.focusTarget);
  },
  { flush: 'post' }
);

function onScroll(event: Event): void {
  const target = event.currentTarget;
  if (target instanceof HTMLElement) {
    updateScrollIndicator(target);
    emit('scrollChange', Math.round(target.scrollTop));
  }
}

function scrollToFocusTarget(target: SchemaDesignSourceFocusTarget): void {
  const shell = shellElement.value;
  if (shell === null) {
    return;
  }

  const targetConstructor = schemaFocusConstructor(target);
  const typeElement = [...shell.querySelectorAll<HTMLElement>('[data-schema-type]')].find(
    (element) => element.dataset.schemaType === target.type
  );
  const typeRowElement =
    [...shell.querySelectorAll<HTMLElement>('[data-schema-type-row]')].find(
      (element) => element.dataset.schemaTypeRow === target.type
    ) ?? null;
  if (targetConstructor === undefined) {
    scrollTypeRowIntoView(shell, typeRowElement);
    return;
  }

  const constructorElement =
    typeElement === undefined
      ? null
      : ([...typeElement.querySelectorAll<HTMLElement>('[data-schema-constructor]')].find(
          (element) => element.dataset.schemaConstructor === targetConstructor
        ) ?? null);
  const targetElement =
    target.field === undefined
      ? constructorElement
      : constructorElement === null
        ? null
        : ([...constructorElement.querySelectorAll<HTMLElement>('[data-schema-field]')].find(
            (element) => element.dataset.schemaField === target.field
          ) ?? null);
  if (targetElement === null) {
    return;
  }

  const shellRect = shell.getBoundingClientRect();
  const targetRect = targetElement.getBoundingClientRect();
  const targetOffset =
    target.field === undefined ? 28 : shell.clientHeight / 2 - targetRect.height / 2;
  const nextScrollTop = Math.max(
    0,
    Math.round(shell.scrollTop + targetRect.top - shellRect.top - targetOffset)
  );
  shell.scrollTop = nextScrollTop;
  updateScrollIndicator(shell);
  emit('scrollChange', nextScrollTop);
}

function scrollTypeRowIntoView(shell: HTMLElement, typeRowElement: HTMLElement | null): void {
  if (typeRowElement === null) {
    return;
  }

  const header = shell.querySelector<HTMLElement>('.schema-design-type-table__head');
  const headerHeight = header?.offsetHeight ?? 0;
  const nextScrollTop = Math.max(0, Math.round(typeRowElement.offsetTop - headerHeight - 2));
  shell.scrollTop = nextScrollTop;
  updateScrollIndicator(shell);
  emit('scrollChange', nextScrollTop);
}
</script>

<template>
  <section class="schema-design-type-table">
    <div ref="shellElement" class="schema-design-type-table__shell" @scroll="onScroll">
      <table class="schema-design-type-table__table">
        <colgroup>
          <col class="schema-design-type-table__type-column" />
        </colgroup>
        <thead class="schema-design-type-table__head">
          <tr class="schema-design-type-table__row">
            <th class="schema-design-type-table__type-heading" scope="col">
              <div class="schema-design-type-table__type-heading-content">
                Type
                <span class="schema-design-type-table__type-heading-count">
                  {{ entries.length }} / {{ totalEntryCount }}
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="schema-design-type-table__body">
          <SchemaDesignTypeRow
            v-for="entry in entries"
            :key="entry.type"
            :detail-expanded="expandedTypeNames.has(entry.type)"
            :entry="entry"
            :expanded-review-keys="expandedReviewKeys"
            :focus-target="focusTarget"
            :max-review-note-count="maxReviewNoteCount"
            :source-hover-target="sourceHoverTarget"
            :tables="tables"
            :table-hover-target="tableHoverTarget"
            @table-focus="emit('tableFocus', $event)"
            @source-hover="emit('sourceHover', $event)"
            @table-hover="emit('tableHover', $event)"
            @detail-expanded-change="emit('typeExpandedChange', entry.type, $event)"
            @review-close="emit('typeReviewClose', entry.type, $event)"
            @review-toggle="emit('typeReviewToggle', entry.type, $event)"
          />
        </tbody>
      </table>
    </div>
    <SchemaDesignScrollIndicator
      :indicator-style="scrollIndicatorStyle"
      :scrollable="scrollIndicatorScrollable"
    />
  </section>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-type-table {
  @apply relative h-full min-h-0 overflow-hidden bg-white;
}

.schema-design-type-table__shell {
  @apply h-full min-h-0 overflow-x-auto overflow-y-scroll overscroll-none [-ms-overflow-style:none] [scrollbar-width:none];
}

.schema-design-type-table__shell::-webkit-scrollbar {
  @apply hidden;
}

.schema-design-type-table__table {
  @apply w-full table-fixed border-separate border-spacing-0 text-left;
}

.schema-design-type-table__type-column {
  @apply w-full;
}

.schema-design-type-table__head {
  @apply sticky top-0 z-10 bg-neutral-100;
}

.schema-design-type-table__row {
  @apply align-top;
}

.schema-design-type-table__type-heading {
  @apply whitespace-nowrap border-b border-neutral-300 px-2 py-1.5 text-xs font-semibold uppercase text-neutral-600;
}

.schema-design-type-table__type-heading-content {
  @apply flex h-[22px] items-center gap-2;
}

.schema-design-type-table__type-heading-count {
  @apply font-mono text-[11px] font-medium normal-case text-neutral-400;
}

.schema-design-type-table__body {
  @apply bg-white;
}
</style>
