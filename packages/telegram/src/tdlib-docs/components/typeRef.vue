<script setup lang="ts">
import { computed } from 'vue';

import { tokenizeTypeReference } from '../schemaIndex.js';
import EntityLink from './entityLink.vue';

const props = defineProps<{
  parentInstanceId: string;
  slotKey: string;
  typeName: string;
}>();

const tokens = computed(() => tokenizeTypeReference(props.typeName));
</script>

<template>
  <span class="type-ref">
    <EntityLink
      v-for="token in tokens"
      :key="token.key"
      :entity-id="token.entityId"
      :parent-instance-id="parentInstanceId"
      :slot-key="slotKey"
      :text="token.text"
    />
  </span>
</template>

<style scoped>
@reference '../style.css';

.type-ref {
  @apply inline-flex flex-wrap items-center gap-0.5 align-baseline;
}
</style>
