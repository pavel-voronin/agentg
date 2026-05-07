<script setup lang="ts">
import { computed } from 'vue';

import { useControlPlaneActions } from '@agentg/control-plane-extension/actions';
import type { SlotContext } from '@agentg/control-plane-extension/slots';
import type { MainWorkspaceContext } from '@agentg/shared/control-plane/views';

import SelectedWorkspace from './components/SelectedWorkspace.vue';

const props = defineProps<{
  slotContext?: SlotContext | undefined;
}>();

const actions = useControlPlaneActions();
const selectedWorkspace = computed(
  () => (props.slotContext as Partial<MainWorkspaceContext> | undefined)?.selectedWorkspace ?? null
);
</script>

<template>
  <SelectedWorkspace
    v-if="selectedWorkspace"
    :view="selectedWorkspace"
    @close="actions.closeSelectedChat"
    @custom-target="actions.addCustomTarget"
    @delete-target="actions.deleteTarget"
    @freeform-scale="actions.clearTimelineScale"
    @preset-target="actions.addPresetTarget"
    @scale-select="actions.selectTimelineScale"
  />
</template>
