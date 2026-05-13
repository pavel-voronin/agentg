<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';

import { schemaCreateTableSql } from '../../schemaDesignView.js';
import type { StorageSchemaTable } from '../../storageReviewTypes.js';

const props = defineProps<{
  table: StorageSchemaTable;
}>();

const sql = computed(() => schemaCreateTableSql(props.table));
const copied = ref(false);
let copiedTimeout: number | null = null;

onBeforeUnmount(() => {
  if (copiedTimeout !== null) {
    window.clearTimeout(copiedTimeout);
  }
});

async function copySql(): Promise<void> {
  await navigator.clipboard.writeText(sql.value);
  copied.value = true;
  if (copiedTimeout !== null) {
    window.clearTimeout(copiedTimeout);
  }
  copiedTimeout = window.setTimeout(() => {
    copied.value = false;
  }, 1200);
}
</script>

<template>
  <section class="schema-design-table-ddl">
    <header class="schema-design-table-ddl__header">
      <span class="schema-design-table-ddl__title">DDL</span>
      <button class="schema-design-table-ddl__copy" type="button" @click="copySql">
        {{ copied ? 'copied' : 'copy' }}
      </button>
    </header>
    <pre class="schema-design-table-ddl__body"><code class="schema-design-table-ddl__code">{{ sql }}</code></pre>
  </section>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-table-ddl {
  @apply rounded border border-neutral-200 bg-neutral-50 p-2;
}

.schema-design-table-ddl__header {
  @apply mb-1 flex items-center justify-between gap-2;
}

.schema-design-table-ddl__title {
  @apply text-[10px] font-semibold uppercase leading-none text-neutral-500;
}

.schema-design-table-ddl__copy {
  @apply h-[18px] appearance-none rounded border border-neutral-300 bg-white px-1.5 font-mono text-[10px] font-semibold uppercase leading-none text-neutral-600 outline-none hover:border-neutral-500 hover:text-neutral-950;
}

.schema-design-table-ddl__body {
  @apply m-0 overflow-auto;
}

.schema-design-table-ddl__code {
  @apply block whitespace-pre font-mono text-xs leading-snug text-neutral-900;
}
</style>
