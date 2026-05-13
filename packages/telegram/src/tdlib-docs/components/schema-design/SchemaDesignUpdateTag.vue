<script setup lang="ts">
import type { TdlibCallableEntity } from '../../types.js';
import EntityLink from '../EntityLink.vue';

defineProps<{
  expanded: boolean;
  parentInstanceId: string;
  slotKey: string;
  update: TdlibCallableEntity;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

function onActivate(event: MouseEvent): void {
  event.preventDefault();
  emit('toggle');
}
</script>

<template>
  <span class="schema-design-update-tag">
    <EntityLink
      :entity-id="update.id"
      :parent-instance-id="parentInstanceId"
      :slot-key="slotKey"
      :text="update.name"
      :title="expanded ? 'Collapse update process' : 'Open update process'"
      @activate="onActivate"
    />
  </span>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-update-tag {
  @apply inline-flex min-w-0 max-w-full items-center;
}
</style>
