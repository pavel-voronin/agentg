<script setup lang="ts">
import { SlotOutlet, type SlotContext } from '@agentg/framework/cp';

const props = defineProps<{
  slotContext?: SlotContext | undefined;
}>();
</script>

<template>
  <div class="client-page-content">
    <SlotOutlet
      :context="props.slotContext"
      slot-id="control-plane.client"
      :tags="['control-plane.client']"
    />
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.client-page-content {
  @apply h-full min-h-0 w-full;
}
</style>
